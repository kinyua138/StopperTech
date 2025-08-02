const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
        match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number']
    },
    institution: { 
        type: String, 
        required: [true, 'Institution is required'],
        trim: true,
        minlength: [2, 'Institution name must be at least 2 characters']
    },
    service: { 
        type: String, 
        required: [true, 'Service selection is required'],
        enum: {
            values: ['admission', 'exam', 'scholarship', 'project', 'other'],
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

// Enhanced API Routes with better error handling
// POST /register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, email, phone, institution, service, message } = req.body;

        // Enhanced validation with detailed error messages
        if (!fullname || !email || !phone || !institution || !service) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: 'Please fill in all required fields.',
                fields: {
                    fullname: fullname ? undefined : 'Full name is required',
                    email: email ? undefined : 'Email is required',
                    phone: phone ? undefined : 'Phone number is required',
                    institution: institution ? undefined : 'Institution is required',
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
            institution,
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
