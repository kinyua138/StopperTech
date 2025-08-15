// Service Form Handler with M-Pesa Integration
class ServiceFormHandler {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.currentServiceRequest = null;
        this.servicePricing = {};
        this.loadServicePricing();
    }

    // Load service pricing from API
    async loadServicePricing() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/service-pricing`);
            const data = await response.json();
            if (data.success) {
                this.servicePricing = data.data;
            }
        } catch (error) {
            console.error('Error loading service pricing:', error);
        }
    }

    // Get price for a specific service
    getServicePrice(serviceType, subService) {
        return this.servicePricing[serviceType]?.[subService] || 0;
    }

    // Format phone number to Kenyan format (254XXXXXXXXX)
    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        phone = phone.replace(/\D/g, '');
        
        // Handle different input formats
        if (phone.startsWith('0')) {
            // Convert 0XXXXXXXXX to 254XXXXXXXXX
            phone = '254' + phone.substring(1);
        } else if (phone.startsWith('254')) {
            // Already in correct format
            phone = phone;
        } else if (phone.startsWith('7') || phone.startsWith('1')) {
            // Handle 7XXXXXXXX or 1XXXXXXXX
            phone = '254' + phone;
        }
        
        return phone;
    }

    // Validate form data
    validateFormData(formData) {
        const errors = [];
        
        if (!formData.fullName || formData.fullName.trim().length < 2) {
            errors.push('Full name must be at least 2 characters long');
        }
        
        if (!formData.email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
            errors.push('Please enter a valid email address');
        }
        
        const formattedPhone = this.formatPhoneNumber(formData.phone);
        if (!formattedPhone || !/^254[0-9]{9}$/.test(formattedPhone)) {
            errors.push('Please enter a valid Kenyan phone number');
        }
        
        if (!formData.nationalId || !/^[0-9]{8}$/.test(formData.nationalId)) {
            errors.push('Please enter a valid 8-digit National ID');
        }
        
        if (!formData.serviceType || !formData.subService) {
            errors.push('Please select a service type and sub-service');
        }
        
        return errors;
    }

    // Submit service request
    async submitServiceRequest(formData) {
        try {
            // Validate form data
            const errors = this.validateFormData(formData);
            if (errors.length > 0) {
                throw new Error(errors.join(', '));
            }

            // Format phone number
            formData.phone = this.formatPhoneNumber(formData.phone);

            const response = await fetch(`${this.apiBaseUrl}/service-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to submit service request');
            }

            this.currentServiceRequest = data.data;
            return data;
        } catch (error) {
            console.error('Error submitting service request:', error);
            throw error;
        }
    }

    // Initiate M-Pesa payment
    async initiatePayment(serviceRequestId, phoneNumber) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            
            const response = await fetch(`${this.apiBaseUrl}/initiate-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    serviceRequestId: serviceRequestId,
                    phoneNumber: formattedPhone
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to initiate payment');
            }

            return data;
        } catch (error) {
            console.error('Error initiating payment:', error);
            throw error;
        }
    }

    // Check payment status
    async checkPaymentStatus(serviceRequestId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/service-request/${serviceRequestId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to check payment status');
            }

            return data.data;
        } catch (error) {
            console.error('Error checking payment status:', error);
            throw error;
        }
    }

    // Show loading state
    showLoading(element, message = 'Processing...') {
        element.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        `;
        element.disabled = true;
    }

    // Show success message
    showSuccess(element, message) {
        element.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        element.classList.add('success');
    }

    // Show error message
    showError(element, message) {
        element.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
            </div>
        `;
        element.classList.add('error');
    }

    // Reset button state
    resetButton(element, originalText) {
        element.innerHTML = originalText;
        element.disabled = false;
        element.classList.remove('success', 'error');
    }

    // Create service request form
    createServiceForm(serviceType, subServices) {
        return `
            <div class="service-request-form">
                <h3>Request ${serviceType} Service</h3>
                <form id="serviceRequestForm">
                    <div class="form-group">
                        <label for="subService">Select Service *</label>
                        <select id="subService" name="subService" required>
                            <option value="">Choose a service...</option>
                            ${subServices.map(service => `
                                <option value="${service}" data-price="${this.getServicePrice(serviceType, service)}">
                                    ${service} - KSh ${this.getServicePrice(serviceType, service)}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="fullName">Full Name *</label>
                        <input type="text" id="fullName" name="fullName" required minlength="2">
                    </div>

                    <div class="form-group">
                        <label for="email">Email Address *</label>
                        <input type="email" id="email" name="email" required>
                    </div>

                    <div class="form-group">
                        <label for="phone">Phone Number *</label>
                        <input type="tel" id="phone" name="phone" required placeholder="0712345678 or 254712345678">
                        <small>Enter your M-Pesa phone number for payment</small>
                    </div>

                    <div class="form-group">
                        <label for="nationalId">National ID *</label>
                        <input type="text" id="nationalId" name="nationalId" required pattern="[0-9]{8}" maxlength="8">
                        <small>8-digit National ID number</small>
                    </div>

                    <div class="service-details-section">
                        <h4>Service Details</h4>
                        <div id="serviceDetailsFields">
                            <!-- Dynamic fields will be inserted here based on selected service -->
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="additionalInfo">Additional Information</label>
                        <textarea id="additionalInfo" name="additionalInfo" rows="3" placeholder="Any additional details or special requirements..."></textarea>
                    </div>

                    <div class="price-display">
                        <div class="price-info">
                            <span>Service Fee: </span>
                            <strong id="servicePrice">KSh 0</strong>
                        </div>
                    </div>

                    <button type="submit" class="submit-btn">
                        <i class="fas fa-paper-plane"></i>
                        Submit Request & Pay
                    </button>
                </form>

                <div id="paymentStatus" class="payment-status" style="display: none;">
                    <!-- Payment status will be shown here -->
                </div>
            </div>
        `;
    }

    // Initialize form for a specific service type
    initializeForm(serviceType, subServices, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID ${containerId} not found`);
            return;
        }

        // Insert form HTML
        container.innerHTML = this.createServiceForm(serviceType, subServices);

        // Get form elements
        const form = document.getElementById('serviceRequestForm');
        const subServiceSelect = document.getElementById('subService');
        const priceDisplay = document.getElementById('servicePrice');
        const serviceDetailsFields = document.getElementById('serviceDetailsFields');

        // Update price when service is selected
        subServiceSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            const price = selectedOption.getAttribute('data-price') || 0;
            priceDisplay.textContent = `KSh ${price}`;

            // Update service details fields based on selected service
            this.updateServiceDetailsFields(serviceType, e.target.value, serviceDetailsFields);
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmission(form, serviceType);
        });
    }

    // Update service details fields based on selected service
    updateServiceDetailsFields(serviceType, subService, container) {
        let fieldsHTML = '';

        // Define specific fields for different services
        const serviceFields = {
            'KRA': {
                'PIN Registration': `
                    <div class="form-group">
                        <label for="employmentStatus">Employment Status *</label>
                        <select id="employmentStatus" name="employmentStatus" required>
                            <option value="">Select status...</option>
                            <option value="employed">Employed</option>
                            <option value="self-employed">Self-Employed</option>
                            <option value="unemployed">Unemployed</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="physicalAddress">Physical Address *</label>
                        <textarea id="physicalAddress" name="physicalAddress" required rows="2"></textarea>
                    </div>
                `,
                'PIN Certificate Retrieval': `
                    <div class="form-group">
                        <label for="kraPin">Current KRA PIN (if known)</label>
                        <input type="text" id="kraPin" name="kraPin" placeholder="A000000000A">
                    </div>
                `,
                'PIN Update': `
                    <div class="form-group">
                        <label for="kraPin">Current KRA PIN *</label>
                        <input type="text" id="kraPin" name="kraPin" required placeholder="A000000000A">
                    </div>
                    <div class="form-group">
                        <label for="updateType">What needs to be updated? *</label>
                        <select id="updateType" name="updateType" required>
                            <option value="">Select update type...</option>
                            <option value="personal-details">Personal Details</option>
                            <option value="contact-info">Contact Information</option>
                            <option value="employment-info">Employment Information</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                `,
                'PIN Email Address Change': `
                    <div class="form-group">
                        <label for="kraPin">Current KRA PIN *</label>
                        <input type="text" id="kraPin" name="kraPin" required placeholder="A000000000A">
                    </div>
                    <div class="form-group">
                        <label for="currentEmail">Current Email Address</label>
                        <input type="email" id="currentEmail" name="currentEmail">
                    </div>
                    <div class="form-group">
                        <label for="newEmail">New Email Address *</label>
                        <input type="email" id="newEmail" name="newEmail" required>
                    </div>
                `
            },
            // Add more service types and their specific fields here
        };

        if (serviceFields[serviceType] && serviceFields[serviceType][subService]) {
            fieldsHTML = serviceFields[serviceType][subService];
        } else {
            // Default fields for services without specific requirements
            fieldsHTML = `
                <div class="form-group">
                    <label for="serviceRequirements">Service Requirements *</label>
                    <textarea id="serviceRequirements" name="serviceRequirements" required rows="3" 
                              placeholder="Please describe what you need for this service..."></textarea>
                </div>
            `;
        }

        container.innerHTML = fieldsHTML;
    }

    // Handle form submission
    async handleFormSubmission(form, serviceType) {
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;

        try {
            // Show loading state
            this.showLoading(submitButton, 'Submitting request...');

            // Collect form data
            const formData = new FormData(form);
            const serviceDetails = {};
            
            // Collect all form fields into serviceDetails
            for (let [key, value] of formData.entries()) {
                if (!['fullName', 'email', 'phone', 'nationalId', 'subService'].includes(key)) {
                    serviceDetails[key] = value;
                }
            }

            const requestData = {
                serviceType: serviceType,
                subService: formData.get('subService'),
                fullName: formData.get('fullName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                nationalId: formData.get('nationalId'),
                serviceDetails: serviceDetails
            };

            // Submit service request
            const response = await this.submitServiceRequest(requestData);
            
            // Show success and initiate payment
            this.showSuccess(submitButton, 'Request submitted! Initiating payment...');

            // Wait a moment then initiate payment
            setTimeout(async () => {
                try {
                    this.showLoading(submitButton, 'Initiating M-Pesa payment...');
                    
                    const paymentResponse = await this.initiatePayment(
                        response.data.id,
                        requestData.phone
                    );

                    // Show payment instructions
                    this.showPaymentInstructions(paymentResponse, response.data);
                    this.resetButton(submitButton, originalButtonText);

                } catch (paymentError) {
                    this.showError(submitButton, `Payment Error: ${paymentError.message}`);
                    setTimeout(() => {
                        this.resetButton(submitButton, originalButtonText);
                    }, 3000);
                }
            }, 2000);

        } catch (error) {
            this.showError(submitButton, `Error: ${error.message}`);
            setTimeout(() => {
                this.resetButton(submitButton, originalButtonText);
            }, 3000);
        }
    }

    // Show payment instructions
    showPaymentInstructions(paymentResponse, serviceRequest) {
        const paymentStatus = document.getElementById('paymentStatus');
        paymentStatus.style.display = 'block';
        paymentStatus.innerHTML = `
            <div class="payment-instructions">
                <div class="payment-header">
                    <i class="fas fa-mobile-alt"></i>
                    <h4>M-Pesa Payment Initiated</h4>
                </div>
                <div class="payment-details">
                    <p><strong>Service:</strong> ${serviceRequest.serviceType} - ${serviceRequest.subService}</p>
                    <p><strong>Amount:</strong> KSh ${serviceRequest.amount}</p>
                    <p><strong>Phone:</strong> ${paymentResponse.data.phoneNumber}</p>
                </div>
                <div class="payment-instructions-text">
                    <p><i class="fas fa-info-circle"></i> Please check your phone for the M-Pesa payment prompt.</p>
                    <p>Enter your M-Pesa PIN to complete the payment.</p>
                </div>
                <div class="payment-status-check">
                    <button onclick="serviceFormHandler.checkPayment('${serviceRequest.id}')" class="check-payment-btn">
                        <i class="fas fa-sync-alt"></i> Check Payment Status
                    </button>
                </div>
            </div>
        `;

        // Auto-check payment status after 30 seconds
        setTimeout(() => {
            this.checkPayment(serviceRequest.id);
        }, 30000);
    }

    // Check payment status
    async checkPayment(serviceRequestId) {
        try {
            const serviceRequest = await this.checkPaymentStatus(serviceRequestId);
            const paymentStatus = document.getElementById('paymentStatus');
            
            if (serviceRequest.paymentStatus === 'completed') {
                paymentStatus.innerHTML = `
                    <div class="payment-success">
                        <i class="fas fa-check-circle"></i>
                        <h4>Payment Successful!</h4>
                        <p>Your service request has been received and is being processed.</p>
                        <p><strong>Reference:</strong> SR${serviceRequest._id.slice(-8)}</p>
                        <p>You will receive updates via email and SMS.</p>
                    </div>
                `;
            } else if (serviceRequest.paymentStatus === 'failed') {
                paymentStatus.innerHTML = `
                    <div class="payment-failed">
                        <i class="fas fa-times-circle"></i>
                        <h4>Payment Failed</h4>
                        <p>The payment could not be processed. Please try again.</p>
                        <button onclick="location.reload()" class="retry-btn">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                `;
            } else {
                // Still pending
                paymentStatus.querySelector('.payment-instructions-text').innerHTML = `
                    <p><i class="fas fa-clock"></i> Payment is still pending. Please complete the M-Pesa transaction.</p>
                `;
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
    }
}

// Initialize global service form handler
const serviceFormHandler = new ServiceFormHandler();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServiceFormHandler;
