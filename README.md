# Stopper Tech - Cyber Cafe & IT Services

A full-stack web application for Stopper Tech cyber cafe and IT services, featuring student registration and admin panel.

## Features

- Responsive landing page with service information
- Student registration form with validation
- Admin panel to view all registrations
- RESTful API with MongoDB integration
- Modern UI with animations and custom cursor effects
- Environment configuration with .env file
- Enhanced error handling with detailed messages
- Loading states and user feedback in frontend
- Production-ready configurations

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd stopper-tech
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your configuration (see example in the existing .env file)

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the server with nodemon for automatic restarts on file changes.

### Production Mode

```bash
npm run prod
```

This will start the server in production mode with enhanced security features.

### Deployment Mode

```bash
npm run deploy
```

This will start the server with optimized settings for deployment. See DEPLOYMENT.md for detailed instructions.

## Usage

After starting the server:

1. Open your browser and navigate to `http://localhost:5000` for the main page
2. Navigate to `http://localhost:5000/admin` for the admin panel

### API Endpoints

- `POST /api/register` - Submit a new student registration
- `GET /api/registrations` - Retrieve all student registrations
- `GET /api/health` - Health check endpoint

## Project Structure

```
stopper-tech/
├── backend/
│   ├── server.js          # Main server file with API endpoints
│   └── deploy.js          # Deployment optimized server file
├── frontend/
│   ├── stopper.html       # Main landing page
│   └── admin.html         # Admin panel to view registrations
├── .env                   # Environment configuration file
├── package.json           # Project dependencies and scripts
├── README.md              # This file
└── DEPLOYMENT.md          # Detailed deployment guide
```

## Frontend Features

### Main Page (stopper.html)
- Responsive design with mobile support
- Custom animated cursor effects
- Smooth scrolling navigation
- Services section with detailed information
- Student registration form with validation
- Testimonials slider with autoplay
- Contact information and footer
- Loading states during API calls
- Enhanced user feedback for form submissions

### Admin Panel (admin.html)
- Clean table layout for registration data
- Automatic data fetching from database
- Responsive design
- Error handling and loading states
- Refresh button for manual data updates
- Success and error message display

## Backend Features

### API Endpoints

1. **POST /api/register**
   - Accepts student registration data
   - Validates required fields with detailed error messages
   - Checks for duplicate entries
   - Stores data in MongoDB
   - Returns success or error message with detailed information

2. **GET /api/registrations**
   - Retrieves all registrations from MongoDB
   - Sorts by creation date (newest first)
   - Returns JSON array of registration objects with success metadata

3. **GET /api/health**
   - Health check endpoint for monitoring
   - Returns service status and environment information

### Database Schema

The application uses MongoDB with the following schema for student registrations:

```javascript
{
  fullname: String (required, min 2 characters),
  email: String (required, valid email format),
  phone: String (required, valid phone format),
  institution: String (required, min 2 characters),
  service: String (required, enum values),
  message: String (optional, max 500 characters),
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Fetch API
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Middleware**: CORS, Body-parser, Helmet (security), Express-rate-limit
- **UI Libraries**: Swiper.js for testimonials slider
- **Icons**: Font Awesome
- **Images**: Unsplash (via direct URLs)

## Security Features

- Helmet middleware for HTTP headers security
- API rate limiting to prevent abuse
- CORS configuration for controlled access
- Input validation and sanitization
- Error handling that doesn't expose sensitive information

## Development

To modify the application:

1. Update frontend files in the `frontend/` directory
2. Modify API endpoints in `backend/server.js`
3. Update MongoDB schema in `backend/server.js` if needed

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

To deploy this application:

1. Set up a MongoDB database (local or cloud)
2. Configure environment variables in `.env` file
3. Deploy the application to a Node.js hosting service (e.g., Heroku, Render)
4. Run the application in production mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, contact:
- Email: info@stoppertech.com
- Phone: 0710590670, 0798692574
