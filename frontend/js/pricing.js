// Service Pricing Utility
// This file handles dynamic pricing fetching and display

class ServicePricingManager {
    constructor() {
        this.pricing = {};
        this.loaded = false;
    }

    // Fetch pricing from API
    async fetchPricing() {
        try {
            const response = await fetch('/api/service-pricing');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            this.pricing = result.data || {};
            this.loaded = true;
            console.log('Service pricing loaded successfully');
            return this.pricing;
        } catch (error) {
            console.error('Error fetching service pricing:', error);
            // Fallback to default pricing if API fails
            this.pricing = this.getDefaultPricing();
            this.loaded = true;
            return this.pricing;
        }
    }

    // Get price for a specific service
    getPrice(serviceType, subService) {
        if (!this.loaded) {
            console.warn('Pricing not loaded yet. Call fetchPricing() first.');
            return null;
        }
        
        if (this.pricing[serviceType] && this.pricing[serviceType][subService]) {
            return this.pricing[serviceType][subService];
        }
        
        console.warn(`Price not found for ${serviceType} - ${subService}`);
        return null;
    }

    // Update pricing display on page
    updatePricingDisplay() {
        if (!this.loaded) {
            console.warn('Pricing not loaded yet.');
            return;
        }

        // Find all elements with data-service-type and data-sub-service attributes
        const priceElements = document.querySelectorAll('[data-service-type][data-sub-service]');
        
        priceElements.forEach(element => {
            const serviceType = element.getAttribute('data-service-type');
            const subService = element.getAttribute('data-sub-service');
            const price = this.getPrice(serviceType, subService);
            
            if (price !== null) {
                // Update the price display
                if (element.classList.contains('price-display')) {
                    element.textContent = `KSh ${price}`;
                } else if (element.querySelector('.price-display')) {
                    element.querySelector('.price-display').textContent = `KSh ${price}`;
                } else {
                    // If no specific price display element, update the element's text
                    element.textContent = element.textContent.replace(/KSh\s*\d+/, `KSh ${price}`);
                }
            }
        });

        console.log('Pricing display updated');
    }

    // Get all pricing data
    getAllPricing() {
        return this.pricing;
    }

    // Default pricing fallback
    getDefaultPricing() {
        return {
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
    }
}

// Create global instance
window.servicePricingManager = new ServicePricingManager();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    await window.servicePricingManager.fetchPricing();
    window.servicePricingManager.updatePricingDisplay();
});

// Refresh pricing every 5 minutes to keep it updated
setInterval(async () => {
    await window.servicePricingManager.fetchPricing();
    window.servicePricingManager.updatePricingDisplay();
}, 5 * 60 * 1000); // 5 minutes
