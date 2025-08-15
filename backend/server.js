const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const session = require('express-session');
const bcrypt = require('bcrypt');
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

// Security middleware with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
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
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Admin credentials configuration
const ADMIN_CONFIG = {
    username: 'admin',
    // Hash of "Stopper@350" - correct hash
    passwordHash: '$2b$10$ucomOwZANedWzqS88kt6/u3fxA/PRShrmf0EVewt1oLPEK8/B0Fly'
};

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'stopper-tech-admin-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: nodeEnv === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Generate password hash on startup (for development)
async function generatePasswordHash() {
    try {
        const hash = await bcrypt.hash('Stopper@350', 10);
        console.log('🔐 Admin password hash generated:', hash);
        return hash;
    } catch (error) {
        console.error('Error generating password hash:', error);
        return null;
    }
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        return next();
    } else {
        return res.status(401).json({
            error: 'Unauthorized',
            details: 'Please login to access this resource.'
        });
    }
}

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: {
        error: 'Too many login attempts',
        details: 'Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Authentication endpoints

// POST /api/admin/login - Admin login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Username and password are required.'
            });
        }

        // Check username
        if (username !== ADMIN_CONFIG.username) {
            return res.status(401).json({
                error: 'Invalid credentials',
                details: 'Invalid username or password.'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, ADMIN_CONFIG.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid credentials',
                details: 'Invalid username or password.'
            });
        }

        // Set session
        req.session.isAuthenticated = true;
        req.session.username = username;

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                username: username,
                loginTime: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'An error occurred during login. Please try again.'
        });
    }
});

// POST /api/admin/logout - Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({
                error: 'Server Error',
                details: 'Failed to logout. Please try again.'
            });
        }
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
});

// GET /api/admin/status - Check authentication status
app.get('/api/admin/status', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.json({
            success: true,
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({
            success: true,
            authenticated: false
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
        enum: ['KRA', 'SHA', 'NSSF', 'NTSA', 'HELB', 'GHRIS', 'TSC', 'OS_SOFTWARE', 'COMPUTER_REPAIR']
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

// Function to validate callback URL
function validateCallbackUrl(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Safaricom requires HTTPS for callback URLs
        if (parsedUrl.protocol !== 'https:') {
            return {
                valid: false,
                error: 'Callback URL must use HTTPS protocol'
            };
        }
        
        // Check if it's a valid webhook.site URL or other valid callback URL
        const validDomains = ['webhook.site', 'ngrok.io', 'herokuapp.com', 'vercel.app', 'netlify.app'];
        const isValidDomain = validDomains.some(domain => parsedUrl.hostname.includes(domain)) || 
                             parsedUrl.hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/) || // IP address
                             parsedUrl.hostname.includes('.'); // Any domain with TLD
        
        if (!isValidDomain) {
            return {
                valid: false,
                error: 'Callback URL must be a publicly accessible HTTPS URL'
            };
        }
        
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid URL format'
        };
    }
}

// Safaricom Daraja API Configuration
const DARAJA_CONFIG = {
    consumerKey: process.env.DARAJA_CONSUMER_KEY,
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
    businessShortCode: process.env.DARAJA_BUSINESS_SHORTCODE || '174379',
    passkey: process.env.DARAJA_PASSKEY,
    // Force use of the specific webhook.site URL - override any environment variable
    callbackUrl: 'https://webhook.site/2579b19f-c7db-41af-a753-f66e6a90aea3',
    environment: process.env.DARAJA_ENVIRONMENT || 'sandbox' // 'sandbox' or 'production'
};

// Add detailed callback URL debugging
console.log('\n🔗 CALLBACK URL CONFIGURATION DEBUG:');
console.log(`Environment Variable DARAJA_CALLBACK_URL: ${process.env.DARAJA_CALLBACK_URL || 'NOT SET'}`);
console.log(`Final Callback URL: ${DARAJA_CONFIG.callbackUrl}`);
console.log(`Callback URL Protocol: ${new URL(DARAJA_CONFIG.callbackUrl).protocol}`);
console.log(`Callback URL Host: ${new URL(DARAJA_CONFIG.callbackUrl).hostname}`);

// Validate callback URL on startup
const callbackValidation = validateCallbackUrl(DARAJA_CONFIG.callbackUrl);
if (!callbackValidation.valid) {
    console.error(`❌ CALLBACK URL ERROR: ${callbackValidation.error}`);
    console.error(`Current callback URL: ${DARAJA_CONFIG.callbackUrl}`);
    console.error('Please ensure your callback URL is a publicly accessible HTTPS URL');
    console.error('🚨 STK Push will fail with this callback URL!');
} else {
    console.log('✅ Callback URL validation passed');
}

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

// Log Daraja API configuration status
console.log('\n🔐 DARAJA API CONFIGURATION:');
console.log(`Consumer Key: ${DARAJA_CONFIG.consumerKey ? '✅ SET' : '❌ MISSING'}`);
console.log(`Consumer Secret: ${DARAJA_CONFIG.consumerSecret ? '✅ SET' : '❌ MISSING'}`);
console.log(`Passkey: ${DARAJA_CONFIG.passkey ? '✅ SET' : '❌ MISSING'}`);
console.log(`Callback URL: ${DARAJA_CONFIG.callbackUrl}`);

if (!DARAJA_CONFIG.consumerKey || !DARAJA_CONFIG.consumerSecret) {
    console.log('\n❌ CRITICAL: Missing Daraja API credentials!');
    console.log('Please set the following environment variables:');
    console.log('- DARAJA_CONSUMER_KEY');
    console.log('- DARAJA_CONSUMER_SECRET');
    console.log('- DARAJA_PASSKEY');
    console.log('\nPayment functionality will not work without these credentials.');
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
    }
};

// Function to get Daraja access token
async function getDarajaAccessToken() {
    try {
        // Check if credentials are available
        if (!DARAJA_CONFIG.consumerKey || !DARAJA_CONFIG.consumerSecret) {
            const errorMsg = 'Missing Daraja API credentials. Please check DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET environment variables.';
            console.error('❌ DARAJA ERROR:', errorMsg);
            throw new Error(errorMsg);
        }

        const auth = Buffer.from(`${DARAJA_CONFIG.consumerKey}:${DARAJA_CONFIG.consumerSecret}`).toString('base64');
        console.log(`🔐 Attempting to get Daraja access token from: ${DARAJA_URLS[DARAJA_CONFIG.environment].oauth}`);
        
        const response = await axios.get(DARAJA_URLS[DARAJA_CONFIG.environment].oauth, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        if (response.data && response.data.access_token) {
            console.log('✅ Successfully obtained Daraja access token');
            console.log(`🔑 Token expires in: ${response.data.expires_in || 'unknown'} seconds`);
            return response.data.access_token;
        } else {
            throw new Error('Invalid response format from Daraja API');
        }
    } catch (error) {
        console.error('❌ Error getting Daraja access token:');
        
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error(`📊 Status: ${error.response.status} ${error.response.statusText}`);
            console.error(`📄 Response data:`, JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 400) {
                console.error('🔍 This is likely due to invalid API credentials.');
                console.error('Please verify your DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET are correct.');
            } else if (error.response.status === 401) {
                console.error('🔐 Authentication failed. Check your credentials.');
            } else if (error.response.status >= 500) {
                console.error('🚨 Safaricom server error. Please try again later.');
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('🌐 No response received from Daraja API');
            console.error('This could be due to network issues or Safaricom API being down');
            if (error.code === 'ECONNABORTED') {
                console.error('⏰ Request timed out. Safaricom API might be slow.');
            }
        } else {
            // Something happened in setting up the request
            console.error('⚙️ Error setting up request:', error.message);
        }
        
        throw new Error(`Failed to get access token: ${error.message}`);
    }
}

// Function to initiate STK Push - Updated to match working JavaScript format
async function initiateStkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
        console.log(`💳 Initiating STK Push for ${phoneNumber}, Amount: KSh ${amount}`);
        
        // Validate callback URL before proceeding
        console.log('🔍 Validating callback URL before STK Push...');
        const callbackValidation = validateCallbackUrl(DARAJA_CONFIG.callbackUrl);
        if (!callbackValidation.valid) {
            console.error(`❌ CALLBACK URL VALIDATION FAILED: ${callbackValidation.error}`);
            console.error(`Current callback URL: ${DARAJA_CONFIG.callbackUrl}`);
            throw new Error(`Invalid callback URL: ${callbackValidation.error}`);
        }
        console.log(`✅ Callback URL validation passed: ${DARAJA_CONFIG.callbackUrl}`);
        
        // Always get a fresh access token for each STK Push request
        console.log('🔄 Getting fresh access token for STK Push...');
        const accessToken = await getDarajaAccessToken();
        console.log(`🎫 Using fresh access token: ${accessToken.substring(0, 20)}...`);
        
        // Generate timestamp in the exact format: YYYYMMDDHHMMSS
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
                         (now.getMonth() + 1).toString().padStart(2, '0') +
                         now.getDate().toString().padStart(2, '0') +
                         now.getHours().toString().padStart(2, '0') +
                         now.getMinutes().toString().padStart(2, '0') +
                         now.getSeconds().toString().padStart(2, '0');
        
        // Validate passkey
        if (!DARAJA_CONFIG.passkey) {
            throw new Error('Missing Daraja passkey. Please check DARAJA_PASSKEY environment variable.');
        }
        
        // Generate password exactly like the working JavaScript example
        const password = Buffer.from(`${DARAJA_CONFIG.businessShortCode}${DARAJA_CONFIG.passkey}${timestamp}`).toString('base64');

        // STK Push data matching the working JavaScript format
        const stkPushData = {
            "BusinessShortCode": parseInt(DARAJA_CONFIG.businessShortCode),
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": parseInt(amount),
            "PartyA": parseInt(phoneNumber),
            "PartyB": parseInt(DARAJA_CONFIG.businessShortCode),
            "PhoneNumber": parseInt(phoneNumber),
            "CallBackURL": DARAJA_CONFIG.callbackUrl,
            "AccountReference": accountReference,
            "TransactionDesc": transactionDesc
        };

        console.log(`📤 STK Push Request Data:`, {
            BusinessShortCode: stkPushData.BusinessShortCode,
            Amount: stkPushData.Amount,
            PhoneNumber: stkPushData.PhoneNumber,
            AccountReference: stkPushData.AccountReference,
            TransactionDesc: stkPushData.TransactionDesc,
            CallBackURL: stkPushData.CallBackURL,
            Timestamp: stkPushData.Timestamp
        });

        // Use axios to match the working fetch request
        const response = await axios.post(DARAJA_URLS[DARAJA_CONFIG.environment].stkPush, stkPushData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            timeout: 30000
        });

        console.log(`📥 STK Push Response:`, JSON.stringify(response.data, null, 2));

        // Check if the response indicates success
        if (response.data && (response.data.ResponseCode === '0' || response.data.ResponseCode === 0)) {
            console.log(`✅ STK Push initiated successfully for ${phoneNumber}`);
            console.log(`🔍 CheckoutRequestID: ${response.data.CheckoutRequestID}`);
            console.log(`🔍 MerchantRequestID: ${response.data.MerchantRequestID}`);
            return response.data;
        } else {
            console.error(`❌ STK Push failed:`, response.data);
            throw new Error(response.data.errorMessage || response.data.ResponseDescription || response.data.errorCode || 'STK Push request failed');
        }
    } catch (error) {
        console.error('❌ Error initiating STK Push:');
        
        if (error.response) {
            console.error(`📊 Status: ${error.response.status} ${error.response.statusText}`);
            console.error(`📄 Response data:`, JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 400) {
                console.error('🔍 Bad request - check your STK Push parameters');
                console.error('💡 Common issues: Invalid phone number format, invalid amount, or malformed request');
            } else if (error.response.status === 401) {
                console.error('🔐 Unauthorized - access token might be expired or invalid');
                console.error('💡 Try regenerating your Daraja API credentials');
            } else if (error.response.status === 500) {
                console.error('🚨 Safaricom server error - this is on their end');
            }
            
            throw new Error(`STK Push failed: ${error.response.data?.errorMessage || error.response.data?.ResponseDescription || error.response.data?.errorCode || 'Server error'}`);
        } else if (error.request) {
            console.error('🌐 No response received from Daraja API');
            if (error.code === 'ECONNABORTED') {
                console.error('⏰ Request timed out - Safaricom API might be slow');
            }
            throw new Error('Network error: Unable to reach Safaricom servers');
        } else {
            console.error('⚙️ Error setting up STK Push request:', error.message);
            throw new Error(`STK Push setup error: ${error.message}`);
        }
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

// GET /registrations endpoint to fetch all registrations (protected)
app.get('/api/registrations', requireAuth, async (req, res) => {
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

// DELETE /register/:id endpoint to delete a user registration by ID (protected)
app.delete('/api/register/:id', requireAuth, async (req, res) => {
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

        // Get service amount from pricing configuration
        const amount = SERVICE_PRICING[serviceType]?.[subService];
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

        // Validate phone number format (should be 254XXXXXXXXX)
        if (!/^254[0-9]{9}$/.test(phoneNumber)) {
            return res.status(400).json({
                error: 'Invalid phone number',
                details: 'Please enter a valid Kenyan phone number in format 254XXXXXXXXX'
            });
        }

        // Initiate STK Push
        const accountReference = `SR${serviceRequest._id.toString().slice(-8)}`;
        const transactionDesc = `${serviceRequest.serviceType} - ${serviceRequest.subService}`;

        const stkPushResponse = await initiateStkPush(
            phoneNumber,
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

// GET /api/service-requests - Get all service requests (admin) (protected)
app.get('/api/service-requests', requireAuth, async (req, res) => {
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

// GET /api/payment-status/:id - Get payment status for a service request
app.get('/api/payment-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📊 Checking payment status for service request: ${id}`);
        
        const serviceRequest = await ServiceRequest.findById(id);
        
        if (!serviceRequest) {
            return res.status(404).json({
                error: 'Not Found',
                details: 'Service request not found.'
            });
        }

        // Return payment status information
        const response = {
            success: true,
            data: {
                id: serviceRequest._id,
                paymentStatus: serviceRequest.paymentStatus,
                status: serviceRequest.status,
                amount: serviceRequest.amount,
                paymentReference: serviceRequest.paymentReference,
                serviceType: serviceRequest.serviceType,
                subService: serviceRequest.subService,
                createdAt: serviceRequest.createdAt,
                updatedAt: serviceRequest.updatedAt
            }
        };

        // Add additional context based on payment status
        if (serviceRequest.paymentStatus === 'pending') {
            response.message = 'Payment is still pending. Please complete the M-Pesa transaction on your phone.';
            response.data.nextAction = 'complete_payment';
        } else if (serviceRequest.paymentStatus === 'completed') {
            response.message = 'Payment completed successfully. Your service request is being processed.';
            response.data.nextAction = 'wait_for_processing';
        } else if (serviceRequest.paymentStatus === 'failed') {
            response.message = 'Payment failed. Please try again or contact support.';
            response.data.nextAction = 'retry_payment';
        }

        console.log(`✅ Payment status retrieved for ${id}: ${serviceRequest.paymentStatus}`);
        res.json(response);
    } catch (error) {
        console.error('Error fetching payment status:', error);
        res.status(500).json({
            error: 'Server Error',
            details: 'Failed to retrieve payment status. Please try again later.'
        });
    }
});

// GET /api/service-pricing - Get service pricing
app.get('/api/service-pricing', (req, res) => {
    res.json({
        success: true,
        data: SERVICE_PRICING
    });
});

// PUT /api/service-request/:id/status - Update service request status (admin) (protected)
app.put('/api/service-request/:id/status', requireAuth, async (req, res) => {
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

// DELETE /api/service-request/:id - Delete service request (admin) (protected)
app.delete('/api/service-request/:id', requireAuth, async (req, res) => {
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
