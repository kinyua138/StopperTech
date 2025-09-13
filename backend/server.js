const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Use environment variables for configuration
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/stoppertech';
const port = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5000';
const nodeEnv = process.env.NODE_ENV || 'development';

// MongoDB connection with enhanced options
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

// Add additional options for production
if (nodeEnv === 'production') {
    mongoOptions.retryWrites = true;
    mongoOptions.w = 'majority';
}

mongoose.connect(mongoURI, mongoOptions)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Failed to connect to MongoDB. Please check your connection string and ensure MongoDB is running.');
    process.exit(1);
});

const app = express();

const { sendNewsletterEmail } = require('./newsletter');

// Simple session storage (in production, use Redis or database)
const adminSessions = new Map();

// Admin credentials
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'Stopper@350'
};

// Generate simple session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Middleware to check admin authentication
function requireAuth(req, res, next) {
    const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.adminSession;
    
    if (!sessionId || !adminSessions.has(sessionId)) {
        return res.status(401).json({
            error: 'Unauthorized',
            details: 'Authentication required'
        });
    }
    
    const session = adminSessions.get(sessionId);
    if (Date.now() > session.expires) {
        adminSessions.delete(sessionId);
        return res.status(401).json({
            error: 'Session expired',
            details: 'Please login again'
        });
    }
    
    req.adminUser = session.username;
    next();
}

// Security middleware with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com", "data:", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://randomuser.me"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        },
    },
}));

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        details: 'You have sent too many requests. Please try again later.'
    }
});

// Apply rate limiting to all requests
app.use(limiter);

// Enhanced middleware with CORS configuration
app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Admin Authentication Endpoints
// POST /api/admin/login - Admin login
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Username and password are required.'
            });
        }

        if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
            return res.status(401).json({
                error: 'Invalid credentials',
                details: 'Incorrect username or password.'
            });
        }

        // Create session
        const sessionId = generateSessionId();
        const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        adminSessions.set(sessionId, {
            username: username,
            expires: expires,
            createdAt: Date.now()
        });

        console.log(`Admin login successful: ${username}`);

        // Set session cookie
        res.cookie('adminSession', sessionId, {
            httpOnly: true,
            secure: nodeEnv === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            message: 'Login successful',
            success: true,
            data: {
                username: username,
                sessionId: sessionId,
                expires: expires
            }
        });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'An unexpected error occurred during login.'
        });
    }
});

// POST /api/admin/logout - Admin logout
app.post('/api/admin/logout', (req, res) => {
    try {
        const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.adminSession;
        
        if (sessionId && adminSessions.has(sessionId)) {
            adminSessions.delete(sessionId);
            console.log('Admin logout successful');
        }

        // Clear session cookie
        res.clearCookie('adminSession');

        res.json({
            message: 'Logout successful',
            success: true
        });
    } catch (error) {
        console.error('Error during admin logout:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'An unexpected error occurred during logout.'
        });
    }
});

// GET /api/admin/status - Check admin authentication status
app.get('/api/admin/status', (req, res) => {
    try {
        const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.adminSession;
        
        if (!sessionId || !adminSessions.has(sessionId)) {
            return res.json({
                success: true,
                authenticated: false
            });
        }

        const session = adminSessions.get(sessionId);
        if (Date.now() > session.expires) {
            adminSessions.delete(sessionId);
            return res.json({
                success: true,
                authenticated: false
            });
        }

        res.json({
            success: true,
            authenticated: true,
            username: session.username
        });
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'An unexpected error occurred while checking authentication status.'
        });
    }
});

// Newsletter subscription endpoint
app.post('/api/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        await sendNewsletterEmail(email);

        res.status(200).json({ message: 'Subscription successful. Confirmation email sent.' });
    } catch (error) {
        console.error('Error sending newsletter email:', error);
        res.status(500).json({ error: 'Failed to send confirmation email. Please try again later.' });
    }
});

// Define a schema for student registration with enhanced validation
const registrationSchema = new mongoose.Schema({
    fullname: { 
        type: String, 
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters']
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: { 
        type: String, 
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^[0-9+\-\s()]{10,20}$/, 'Please enter a valid phone number']
    },
    location: { 
        type: String, 
        required: [true, 'Location is required'],
        trim: true,
        minlength: [2, 'Location must be at least 2 characters']
    },
    service: { 
        type: String, 
        required: [true, 'Service selection is required'],
        enum: {
            values: ['helb', 'exam', 'kuccps', 'project', 'visa', 'other'],
            message: 'Please select a valid service'
        }
    },
    message: { 
        type: String,
        trim: true,
        maxlength: [500, 'Message cannot exceed 500 characters']
    }
}, { 
    timestamps: true 
});

const Registration = mongoose.model('Registration', registrationSchema);

// Define schemas for government service requests
const serviceRequestSchema = new mongoose.Schema({
    serviceType: { 
        type: String, 
        required: [true, 'Service type is required'],
        enum: ['KRA', 'SHA', 'NSSF', 'NTSA', 'HELB', 'GHRIS', 'TSC', 'OS_SOFTWARE', 'COMPUTER_REPAIR', 'CYBER_CAFE', 'ONLINE_SHOPPING']
    },
    subService: { 
        type: String, 
        required: [true, 'Sub-service is required'],
        trim: true
    },
    fullName: { 
        type: String, 
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters']
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: { 
        type: String, 
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^254[0-9]{9}$/, 'Please enter a valid Kenyan phone number (254XXXXXXXXX)']
    },
    nationalId: { 
        type: String, 
        required: [true, 'National ID is required'],
        trim: true,
        match: [/^[0-9]{8}$/, 'Please enter a valid 8-digit National ID']
    },
    serviceDetails: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    paymentReference: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Service amount is required'],
        min: [1, 'Amount must be greater than 0']
    },
    status: {
        type: String,
        enum: ['submitted', 'processing', 'completed', 'cancelled'],
        default: 'submitted'
    }
}, { 
    timestamps: true 
});

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);

// Define schema for service pricing
const servicePricingSchema = new mongoose.Schema({
    serviceType: {
        type: String,
        required: true,
        enum: ['KRA', 'SHA', 'NSSF', 'NTSA', 'HELB', 'GHRIS', 'TSC', 'OS_SOFTWARE', 'COMPUTER_REPAIR', 'CYBER_CAFE', 'ONLINE_SHOPPING']
    },
    subService: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: [1, 'Price must be greater than 0']
    }
}, {
    timestamps: true
});

// Create compound index to ensure unique service-subservice combinations
servicePricingSchema.index({ serviceType: 1, subService: 1 }, { unique: true });

const ServicePricing = mongoose.model('ServicePricing', servicePricingSchema);

// Function to initialize default pricing in database
async function initializeDefaultPricing() {
    try {
        const existingCount = await ServicePricing.countDocuments();
        if (existingCount === 0) {
            console.log('Initializing default service pricing in database...');
            
            const pricingEntries = [];
            for (const [serviceType, services] of Object.entries(SERVICE_PRICING)) {
                for (const [subService, price] of Object.entries(services)) {
                    pricingEntries.push({
                        serviceType,
                        subService,
                        price
                    });
                }
            }
            
            await ServicePricing.insertMany(pricingEntries);
            console.log(`✅ Initialized ${pricingEntries.length} default pricing entries`);
        } else {
            console.log(`📋 Found ${existingCount} existing pricing entries in database`);
        }
    } catch (error) {
        console.error('Error initializing default pricing:', error);
        console.log('⚠️  Will use in-memory pricing as fallback');
    }
}

// Initialize default pricing after MongoDB connection
mongoose.connection.once('open', () => {
    initializeDefaultPricing();
});

// Safaricom Daraja API Configuration
const DARAJA_CONFIG = {
    consumerKey: process.env.DARAJA_CONSUMER_KEY,
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
    businessShortCode: process.env.DARAJA_BUSINESS_SHORTCODE || '174379',
    passkey: process.env.DARAJA_PASSKEY,
    // Force use of working webhook.site URL - ignore environment variable
    callbackUrl: 'https://webhook.site/2579b19f-c7db-41af-a753-f66e6a90aea3',
    environment: process.env.DARAJA_ENVIRONMENT || 'sandbox' // 'sandbox' or 'production'
};

// Business Configuration - IMPORTANT FOR RECEIVING PAYMENTS
const BUSINESS_CONFIG = {
    name: 'Stopper Tech Services',
    owner: process.env.BUSINESS_OWNER || 'Stopper Tech',
    phone: process.env.BUSINESS_PHONE || '+254713159136',
    email: process.env.BUSINESS_EMAIL || 'services@stoppertech.co.ke',
    // WARNING: Current setup uses sandbox shortcode 174379
    // Payments go to Safaricom test account, NOT to you!
    // Get your own business shortcode for production
    isReceivingPayments: DARAJA_CONFIG.businessShortCode !== '174379',
    paymentDestination: DARAJA_CONFIG.businessShortCode === '174379' 
        ? 'Safaricom Test Account (NO MONEY RECEIVED)' 
        : `Your Business Account (${DARAJA_CONFIG.businessShortCode})`
};

// Log payment configuration on startup
console.log('\n🏢 BUSINESS PAYMENT CONFIGURATION:');
console.log(`Business Name: ${BUSINESS_CONFIG.name}`);
console.log(`Environment: ${DARAJA_CONFIG.environment}`);
console.log(`Business Shortcode: ${DARAJA_CONFIG.businessShortCode}`);
console.log(`Payment Destination: ${BUSINESS_CONFIG.paymentDestination}`);
console.log(`Will Receive Real Money: ${BUSINESS_CONFIG.isReceivingPayments ? '✅ YES' : '❌ NO - SANDBOX ONLY'}`);
if (!BUSINESS_CONFIG.isReceivingPayments) {
    console.log('⚠️  WARNING: Using sandbox shortcode 174379 - payments go to Safaricom, not you!');
    console.log('📋 Get your own business shortcode to receive payments');
}
console.log('');

// Daraja API URLs
const DARAJA_URLS = {
    sandbox: {
        oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    },
    production: {
        oauth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    }
};

// Service pricing configuration
const SERVICE_PRICING = {
    KRA: {
        'PIN Registration': 500,
        'PIN Certificate Retrieval': 300,
        'PIN Update': 400,
        'PIN Email Address Change': 350
    },
    SHA: {
        'SHA Registration': 400,
        'SHA Certificate Retrieval': 300,
        'SHA Mobile Number Update': 250,
        'SHA Beneficiary Management': 450
    },
    NSSF: {
        'NSSF Registration': 450,
        'NSSF Certificate Retrieval': 300,
        'NSSF Statement Request': 200,
        'NSSF Benefits Claims': 600
    },
    NTSA: {
        'Driving License Application': 800,
        'Vehicle Registration': 700,
        'PSV License Application': 900,
        'Logbook Services': 600
    },
    HELB: {
        'HELB Loan Application': 600,
        'HELB Statement Request': 250,
        'HELB Clearance Certificate': 400,
        'HELB Account Management': 500
    },
    GHRIS: {
        'GHRIS Registration': 500,
        'Payslip Access': 200,
        'Leave Application': 300,
        'Employee Records Management': 450
    },
    TSC: {
        'TSC Registration': 550,
        'Teacher Certification': 600,
        'Transfer Applications': 500,
        'Professional Development': 400
    },
    OS_SOFTWARE: {
        'Windows 10 Installation': 1500,
        'Windows 11 Installation': 1800,
        'Linux Installation': 1200,
        'Antivirus Setup': 300,
        'Premium Antivirus': 2500,
        'MS Office 2019': 1500,
        'MS Office 2021': 2000,
        'System Optimization': 1000,
        'Driver Updates': 800,
        'Custom Software Installation': 500
    },
    COMPUTER_REPAIR: {
        'Virus Removal': 800,
        'Advanced Malware Removal': 1200,
        'Hardware Diagnosis': 500,
        'Component Replacement': 800,
        'Data Recovery': 1500,
        'Hard Drive Recovery': 3000,
        'Screen Replacement 14"': 8000,
        'Screen Replacement 15.6"': 9500,
        'RAM Upgrade': 4500,
        'SSD Installation': 6000,
        'System Cleanup': 800,
        'Emergency Repair': 1300
    },
    CYBER_CAFE: {
        'Internet Browsing (1 Hour)': 50,
        'Internet Browsing (2 Hours)': 90,
        'Internet Browsing (Half Day)': 200,
        'Internet Browsing (Full Day)': 350,
        'Document Typing (Per Page)': 50,
        'Document Printing (Black & White)': 10,
        'Document Printing (Color)': 20,
        'Document Scanning': 20,
        'Photocopying (Per Page)': 5,
        'Email Services': 30,
        'CV Writing': 300,
        'Application Letter Writing': 200,
        'Research Services (Per Hour)': 100,
        'Online Form Filling': 150,
        'Social Media Management': 200,
        'Video Conferencing (Per Hour)': 100,
        'File Transfer Services': 50,
        'USB/Flash Disk Services': 30,
        'CD/DVD Burning': 100,
        'Lamination (A4)': 50,
        'Lamination (A3)': 80,
        'Binding Services': 100,
        'Passport Photo Printing': 100
    },
    ONLINE_SHOPPING: {
        'Account Setup': 200,
        'Address Book': 150,
        'Shopping Assistance': 300,
        'Order Tracking': 100,
        'Pickup Service': 100,
        'Complete Package': 500
    }
};

// Function to get Daraja access token
async function getDarajaAccessToken() {
    try {
        const auth = Buffer.from(`${DARAJA_CONFIG.consumerKey}:${DARAJA_CONFIG.consumerSecret}`).toString('base64');
        const response = await axios.get(DARAJA_URLS[DARAJA_CONFIG.environment].oauth, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Daraja access token:', error);
        throw new Error('Failed to get access token');
    }
}

// Function to initiate STK Push
async function initiateStkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
        const accessToken = await getDarajaAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${DARAJA_CONFIG.businessShortCode}${DARAJA_CONFIG.passkey}${timestamp}`).toString('base64');

        const stkPushData = {
            BusinessShortCode: DARAJA_CONFIG.businessShortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phoneNumber,
            PartyB: DARAJA_CONFIG.businessShortCode,
            PhoneNumber: phoneNumber,
            CallBackURL: DARAJA_CONFIG.callbackUrl,
            AccountReference: accountReference,
            TransactionDesc: transactionDesc
        };

        const response = await axios.post(DARAJA_URLS[DARAJA_CONFIG.environment].stkPush, stkPushData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error initiating STK Push:', error);
        throw new Error('Failed to initiate payment');
    }
}

// Enhanced API Routes with better error handling
// POST /register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, email, phone, location, service, message } = req.body;

        // Enhanced validation with detailed error messages
        if (!fullname || !email || !phone || !location || !service) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: 'Please fill in all required fields.',
                fields: {
                    fullname: fullname ? undefined : 'Full name is required',
                    email: email ? undefined : 'Email is required',
                    phone: phone ? undefined : 'Phone number is required',
                    location: location ? undefined : 'Location is required',
                    service: service ? undefined : 'Service selection is required'
                }
            });
        }

        // Check if email already exists
        const existingRegistration = await Registration.findOne({ email: email });
        if (existingRegistration) {
            return res.status(409).json({ 
                error: 'Duplicate entry',
                details: 'A registration with this email already exists.'
            });
        }

        const newRegistration = new Registration({
            fullname,
            email,
            phone,
            location,
            service,
            message
        });

        await newRegistration.save();

        res.status(201).json({ 
            message: 'Registration successful!',
            success: true,
            data: {
                id: newRegistration._id,
                fullname: newRegistration.fullname,
                email: newRegistration.email
            }
        });
    } catch (error) {
        console.error('Error saving registration:', error);
        
        // Handle specific MongoDB errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                error: 'Validation Error',
                details: errors.join(', ')
            });
        }
        
        if (error.code === 11000) {
            return res.status(409).json({ 
                error: 'Duplicate Entry',
                details: 'A registration with this email already exists.'
            });
        }
        
        res.status(500).json({ 
            error: 'Server Error',
            details: 'An unexpected error occurred while processing your registration. Please try again later.'
        });
    }
});

// GET /registrations endpoint to fetch all registrations
app.get('/api/registrations', async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ createdAt: -1 });
        res.json({ 
            success: true,
            count: registrations.length,
            data: registrations
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ 
            error: 'Server Error',
            details: 'Failed to retrieve registrations. Please try again later.'
        });
    }
});

// DELETE /register/:id endpoint to delete a user registration by ID
app.delete('/api/register/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Attempting to delete registration with ID: ${id}`);
        const deletedRegistration = await Registration.findByIdAndDelete(id);
        if (!deletedRegistration) {
            console.log(`No registration found with ID: ${id}`);
            return res.status(404).json({
                error: 'Not Found',
                details: 'User registration not found.'
            });
        }
        console.log(`Deleted registration with ID: ${id}`);
        res.json({
            message: 'User registration deleted successfully.',
            success: true,
            data: deletedRegistration
        });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to delete user registration. Please try again later.'
        });
    }
});

// Government Service Request Endpoints

// POST /api/service-request - Submit a new service request
app.post('/api/service-request', async (req, res) => {
    try {
        const { serviceType, subService, fullName, email, phone, nationalId, serviceDetails } = req.body;

        // Validate required fields
        if (!serviceType || !subService || !fullName || !email || !phone || !nationalId || !serviceDetails) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Please fill in all required fields.',
                fields: {
                    serviceType: serviceType ? undefined : 'Service type is required',
                    subService: subService ? undefined : 'Sub-service is required',
                    fullName: fullName ? undefined : 'Full name is required',
                    email: email ? undefined : 'Email is required',
                    phone: phone ? undefined : 'Phone number is required',
                    nationalId: nationalId ? undefined : 'National ID is required',
                    serviceDetails: serviceDetails ? undefined : 'Service details are required'
                }
            });
        }

        // Get service amount from database first, fallback to in-memory pricing
        let amount;
        try {
            const pricingDoc = await ServicePricing.findOne({ serviceType, subService });
            amount = pricingDoc ? pricingDoc.price : SERVICE_PRICING[serviceType]?.[subService];
        } catch (error) {
            console.error('Error fetching pricing from database:', error);
            amount = SERVICE_PRICING[serviceType]?.[subService];
        }
        
        if (!amount) {
            return res.status(400).json({
                error: 'Invalid service',
                details: 'The selected service is not available or pricing not configured.'
            });
        }

        // Create service request
        const serviceRequest = new ServiceRequest({
            serviceType,
            subService,
            fullName,
            email,
            phone,
            nationalId,
            serviceDetails,
            amount
        });

        await serviceRequest.save();

        res.status(201).json({
            message: 'Service request submitted successfully!',
            success: true,
            data: {
                id: serviceRequest._id,
                serviceType: serviceRequest.serviceType,
                subService: serviceRequest.subService,
                amount: serviceRequest.amount,
                status: serviceRequest.status
            }
        });
    } catch (error) {
        console.error('Error saving service request:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                error: 'Validation Error',
                details: errors.join(', ')
            });
        }
        
        res.status(500).json({
            error: 'Server Error',
            details: 'An unexpected error occurred while processing your request. Please try again later.'
        });
    }
});

// POST /api/initiate-payment - Initiate M-Pesa payment
app.post('/api/initiate-payment', async (req, res) => {
    try {
        const { serviceRequestId, phoneNumber } = req.body;

        if (!serviceRequestId || !phoneNumber) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Service request ID and phone number are required.'
            });
        }

        // Find the service request
        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) {
            return res.status(404).json({
                error: 'Not Found',
                details: 'Service request not found.'
            });
        }

        if (serviceRequest.paymentStatus === 'completed') {
            return res.status(400).json({
                error: 'Payment already completed',
                details: 'This service request has already been paid for.'
            });
        }

        // Auto-format phone number: if user enters 9 digits, prepend 254
        let formattedPhoneNumber = phoneNumber;
        if (/^[0-9]{9}$/.test(phoneNumber)) {
            // User entered 9 digits, prepend 254
            formattedPhoneNumber = `254${phoneNumber}`;
        } else if (!/^254[0-9]{9}$/.test(phoneNumber)) {
            // Not 9 digits and not valid 254XXXXXXXXX format
            return res.status(400).json({
                error: 'Invalid phone number',
                details: 'Please enter a valid Kenyan phone number (9 digits like 713159136 or full format 254713159136)'
            });
        }

        // Initiate STK Push
        const accountReference = `SR${serviceRequest._id.toString().slice(-8)}`;
        const transactionDesc = `${serviceRequest.serviceType} - ${serviceRequest.subService}`;

        const stkPushResponse = await initiateStkPush(
            formattedPhoneNumber,
            serviceRequest.amount,
            accountReference,
            transactionDesc
        );

        // Update service request with payment reference
        serviceRequest.paymentReference = stkPushResponse.CheckoutRequestID;
        await serviceRequest.save();

        res.status(200).json({
            message: 'Payment initiated successfully. Please check your phone for M-Pesa prompt.',
            success: true,
            data: {
                checkoutRequestId: stkPushResponse.CheckoutRequestID,
                merchantRequestId: stkPushResponse.MerchantRequestID,
                amount: serviceRequest.amount,
                phoneNumber: phoneNumber
            }
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            error: 'Payment Error',
            details: 'Failed to initiate payment. Please try again later.'
        });
    }
});

// POST /api/mpesa/callback - M-Pesa callback endpoint
app.post('/api/mpesa/callback', async (req, res) => {
    try {
        console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

        const { Body } = req.body;
        if (!Body || !Body.stkCallback) {
            return res.status(400).json({ error: 'Invalid callback data' });
        }

        const { CheckoutRequestID, ResultCode, ResultDesc } = Body.stkCallback;

        // Find service request by payment reference
        const serviceRequest = await ServiceRequest.findOne({ paymentReference: CheckoutRequestID });
        if (!serviceRequest) {
            console.log(`Service request not found for CheckoutRequestID: ${CheckoutRequestID}`);
            return res.status(404).json({ error: 'Service request not found' });
        }

        // Update payment status based on result code
        if (ResultCode === 0) {
            // Payment successful
            serviceRequest.paymentStatus = 'completed';
            serviceRequest.status = 'processing';
            console.log(`Payment completed for service request: ${serviceRequest._id}`);
        } else {
            // Payment failed
            serviceRequest.paymentStatus = 'failed';
            console.log(`Payment failed for service request: ${serviceRequest._id}, Reason: ${ResultDesc}`);
        }

        await serviceRequest.save();

        res.status(200).json({ message: 'Callback processed successfully' });
    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        res.status(500).json({ error: 'Failed to process callback' });
    }
});

// GET /api/service-requests - Get all service requests (admin)
app.get('/api/service-requests', async (req, res) => {
    try {
        const serviceRequests = await ServiceRequest.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: serviceRequests.length,
            data: serviceRequests
        });
    } catch (error) {
        console.error('Error fetching service requests:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to retrieve service requests. Please try again later.'
        });
    }
});

// GET /api/service-request/:id - Get specific service request
app.get('/api/service-request/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const serviceRequest = await ServiceRequest.findById(id);
        
        if (!serviceRequest) {
            return res.status(404).json({
                error: 'Not Found',
                details: 'Service request not found.'
            });
        }

        res.json({
            success: true,
            data: serviceRequest
        });
    } catch (error) {
        console.error('Error fetching service request:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to retrieve service request. Please try again later.'
        });
    }
});

// GET /api/service-pricing - Get service pricing (combines database and in-memory pricing)
app.get('/api/service-pricing', async (req, res) => {
    try {
        // Start with in-memory pricing as base
        const combinedPricing = JSON.parse(JSON.stringify(SERVICE_PRICING));
        
        // Get all pricing from database and override in-memory prices
        const dbPricing = await ServicePricing.find();
        
        dbPricing.forEach(item => {
            if (combinedPricing[item.serviceType]) {
                combinedPricing[item.serviceType][item.subService] = item.price;
            }
        });

        res.json({
            success: true,
            data: combinedPricing
        });
    } catch (error) {
        console.error('Error fetching service pricing:', error);
        // Fallback to in-memory pricing if database fails
        res.json({
            success: true,
            data: SERVICE_PRICING
        });
    }
});

// PUT /api/service-pricing - Update service pricing (admin) - saves to database
app.put('/api/service-pricing', requireAuth, async (req, res) => {
    try {
        const { serviceType, subService, price } = req.body;

        if (!serviceType || !subService || !price) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Service type, sub-service, and price are required.'
            });
        }

        if (price <= 0) {
            return res.status(400).json({
                error: 'Invalid price',
                details: 'Price must be greater than 0.'
            });
        }

        if (!SERVICE_PRICING[serviceType]) {
            return res.status(404).json({
                error: 'Service type not found',
                details: `Service type '${serviceType}' does not exist.`
            });
        }

        if (!SERVICE_PRICING[serviceType][subService]) {
            return res.status(404).json({
                error: 'Sub-service not found',
                details: `Sub-service '${subService}' does not exist in '${serviceType}'.`
            });
        }

        // Get old price (from database first, then fallback to in-memory)
        let oldPrice;
        try {
            const existingPricing = await ServicePricing.findOne({ serviceType, subService });
            oldPrice = existingPricing ? existingPricing.price : SERVICE_PRICING[serviceType][subService];
        } catch (error) {
            oldPrice = SERVICE_PRICING[serviceType][subService];
        }

        // Update or create pricing in database
        await ServicePricing.findOneAndUpdate(
            { serviceType, subService },
            { price },
            { upsert: true, new: true }
        );

        // Also update in-memory pricing for immediate consistency
        SERVICE_PRICING[serviceType][subService] = price;

        console.log(`Price updated in database: ${serviceType} - ${subService}: ${oldPrice} → ${price}`);

        res.json({
            message: 'Service price updated successfully.',
            success: true,
            data: {
                serviceType,
                subService,
                oldPrice,
                newPrice: price
            }
        });
    } catch (error) {
        console.error('Error updating service price:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'Duplicate Entry',
                details: 'This service pricing already exists.'
            });
        }
        
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to update service price. Please try again later.'
        });
    }
});

// PUT /api/service-request/:id/status - Update service request status (admin)
app.put('/api/service-request/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['submitted', 'processing', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                details: 'Status must be one of: submitted, processing, completed, cancelled'
            });
        }

        const serviceRequest = await ServiceRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!serviceRequest) {
            return res.status(404).json({
                error: 'Not Found',
                details: 'Service request not found.'
            });
        }

        res.json({
            message: 'Service request status updated successfully.',
            success: true,
            data: serviceRequest
        });
    } catch (error) {
        console.error('Error updating service request status:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to update service request status. Please try again later.'
        });
    }
});

// DELETE /api/service-request/:id - Delete service request (admin)
app.delete('/api/service-request/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Attempting to delete service request with ID: ${id}`);
        
        const deletedServiceRequest = await ServiceRequest.findByIdAndDelete(id);
        if (!deletedServiceRequest) {
            console.log(`No service request found with ID: ${id}`);
            return res.status(404).json({
                error: 'Not Found',
                details: 'Service request not found.'
            });
        }
        
        console.log(`Deleted service request with ID: ${id}`);
        res.json({
            message: 'Service request deleted successfully.',
            success: true,
            data: deletedServiceRequest
        });
    } catch (error) {
        console.error('Error deleting service request:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to delete service request. Please try again later.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK',
        service: 'Stopper Tech API',
        timestamp: new Date().toISOString(),
        environment: nodeEnv
    });
});

// Serve the main frontend page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'stopper.html'));
});

// Serve the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        details: 'An unexpected error occurred. Please try again later.'
    });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        details: 'The requested resource does not exist.'
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${nodeEnv}`);
    console.log(`Frontend available at http://localhost:${port}`);
    console.log(`Admin panel available at http://localhost:${port}/admin`);
    
    // Additional production logging
    if (nodeEnv === 'production') {
        console.log('Running in production mode');
    }
});
