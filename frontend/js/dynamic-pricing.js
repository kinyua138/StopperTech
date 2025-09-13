/**
 * Dynamic Pricing Manager
 * Fetches pricing from API and updates price displays on service pages
 */
class DynamicPricingManager {
    constructor() {
        this.pricing = {};
        this.isLoaded = false;
    }

    /**
     * Initialize dynamic pricing for a service page
     * @param {string} serviceType - The service type (e.g., 'KRA', 'SHA', etc.)
     */
    async init(serviceType) {
        try {
            await this.loadPricing();
            this.updatePricesOnPage(serviceType);
            console.log(`Dynamic pricing initialized for ${serviceType}`);
        } catch (error) {
            console.error('Failed to initialize dynamic pricing:', error);
            // Fallback to hardcoded prices if API fails
        }
    }

    /**
     * Load pricing data from API
     */
    async loadPricing() {
        try {
            const response = await fetch('/api/service-pricing');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            this.pricing = result.data || {};
            this.isLoaded = true;
            console.log('Pricing data loaded:', this.pricing);
        } catch (error) {
            console.error('Error loading pricing:', error);
            throw error;
        }
    }

    /**
     * Get price for a specific service
     * @param {string} serviceType - Service type
     * @param {string} subService - Sub-service name
     * @returns {number|null} Price or null if not found
     */
    getPrice(serviceType, subService) {
        if (!this.isLoaded || !this.pricing[serviceType]) {
            return null;
        }
        return this.pricing[serviceType][subService] || null;
    }

    /**
     * Update all price displays on the current page
     * @param {string} serviceType - The service type for this page
     */
    updatePricesOnPage(serviceType) {
        if (!this.pricing[serviceType]) {
            console.warn(`No pricing data found for service type: ${serviceType}`);
            return;
        }

        // Update price displays in service forms
        const pricingData = this.pricing[serviceType];
        
        // Method 1: Update by data-service attribute
        const serviceForms = document.querySelectorAll('[data-service]');
        serviceForms.forEach(form => {
            const subService = form.getAttribute('data-service');
            const price = pricingData[subService];
            
            if (price) {
                const priceDisplay = form.querySelector('.price-display strong');
                if (priceDisplay) {
                    priceDisplay.textContent = `KSh ${price}`;
                    console.log(`Updated price for ${subService}: KSh ${price}`);
                }
            }
        });

        // Method 2: Update by service name matching
        Object.keys(pricingData).forEach(subService => {
            const price = pricingData[subService];
            
            // Find price displays that contain this service name
            const priceDisplays = document.querySelectorAll('.price-display');
            priceDisplays.forEach(display => {
                const parentCard = display.closest('.service-detail-card');
                if (parentCard) {
                    const cardTitle = parentCard.querySelector('h3');
                    if (cardTitle && cardTitle.textContent.includes(subService)) {
                        const priceElement = display.querySelector('strong');
                        if (priceElement) {
                            priceElement.textContent = `KSh ${price}`;
                            console.log(`Updated price for ${subService}: KSh ${price}`);
                        }
                    }
                }
            });
        });

        // Method 3: Update specific service cards by ID or class
        this.updateSpecificServicePrices(serviceType, pricingData);
    }

    /**
     * Update specific service prices based on service type
     * @param {string} serviceType - Service type
     * @param {object} pricingData - Pricing data for this service type
     */
    updateSpecificServicePrices(serviceType, pricingData) {
        switch (serviceType) {
            case 'KRA':
                this.updateKRAPrices(pricingData);
                break;
            case 'SHA':
                this.updateSHAPrices(pricingData);
                break;
            case 'NSSF':
                this.updateNSSFPrices(pricingData);
                break;
            case 'NTSA':
                this.updateNTSAPrices(pricingData);
                break;
            case 'HELB':
                this.updateHELBPrices(pricingData);
                break;
            case 'GHRIS':
                this.updateGHRISPrices(pricingData);
                break;
            case 'TSC':
                this.updateTSCPrices(pricingData);
                break;
            case 'OS_SOFTWARE':
                this.updateOSSoftwarePrices(pricingData);
                break;
            case 'COMPUTER_REPAIR':
                this.updateComputerRepairPrices(pricingData);
                break;
            case 'CYBER_CAFE':
                this.updateCyberCafePrices(pricingData);
                break;
        }
    }

    /**
     * Update KRA service prices
     */
    updateKRAPrices(pricingData) {
        const serviceMapping = {
            'PIN Registration': 'PIN Registration',
            'PIN Certificate Retrieval': 'PIN Certificate Retrieval',
            'PIN Update': 'PIN Update',
            'PIN Email Address Change': 'PIN Email Address Change'
        };

        Object.keys(serviceMapping).forEach(displayName => {
            const serviceName = serviceMapping[displayName];
            const price = pricingData[serviceName];
            
            if (price) {
                // Find the service card containing this service
                const serviceCards = document.querySelectorAll('.service-detail-card');
                serviceCards.forEach(card => {
                    const title = card.querySelector('h3');
                    if (title && title.textContent.includes(displayName)) {
                        const priceDisplay = card.querySelector('.price-display strong');
                        if (priceDisplay) {
                            priceDisplay.textContent = `KSh ${price}`;
                        }
                    }
                });
            }
        });
    }

    /**
     * Update SHA service prices
     */
    updateSHAPrices(pricingData) {
        // Similar implementation for SHA services
        console.log('Updating SHA prices:', pricingData);
    }

    /**
     * Update NSSF service prices
     */
    updateNSSFPrices(pricingData) {
        // Similar implementation for NSSF services
        console.log('Updating NSSF prices:', pricingData);
    }

    /**
     * Update NTSA service prices
     */
    updateNTSAPrices(pricingData) {
        // Similar implementation for NTSA services
        console.log('Updating NTSA prices:', pricingData);
    }

    /**
     * Update HELB service prices
     */
    updateHELBPrices(pricingData) {
        // Similar implementation for HELB services
        console.log('Updating HELB prices:', pricingData);
    }

    /**
     * Update GHRIS service prices
     */
    updateGHRISPrices(pricingData) {
        // Similar implementation for GHRIS services
        console.log('Updating GHRIS prices:', pricingData);
    }

    /**
     * Update TSC service prices
     */
    updateTSCPrices(pricingData) {
        // Similar implementation for TSC services
        console.log('Updating TSC prices:', pricingData);
    }

    /**
     * Update OS Software service prices
     */
    updateOSSoftwarePrices(pricingData) {
        // Similar implementation for OS Software services
        console.log('Updating OS Software prices:', pricingData);
    }

    /**
     * Update Computer Repair service prices
     */
    updateComputerRepairPrices(pricingData) {
        // Similar implementation for Computer Repair services
        console.log('Updating Computer Repair prices:', pricingData);
    }

    /**
     * Refresh pricing data and update displays
     * @param {string} serviceType - Service type to refresh
     */
    async refresh(serviceType) {
        try {
            await this.loadPricing();
            this.updatePricesOnPage(serviceType);
            console.log(`Pricing refreshed for ${serviceType}`);
        } catch (error) {
            console.error('Failed to refresh pricing:', error);
        }
    }

    /**
     * Update Cyber Cafe service prices
     */
    updateCyberCafePrices(pricingData) {
        const serviceCards = document.querySelectorAll('.service-detail-card');
        Object.keys(pricingData).forEach(subService => {
            const price = pricingData[subService];
            serviceCards.forEach(card => {
                const title = card.querySelector('h3');
                if (title && title.textContent.includes(subService)) {
                    const priceDisplay = card.querySelector('.price-display strong');
                    if (priceDisplay) {
                        priceDisplay.textContent = `KSh ${price}`;
                        console.log(`Updated Cyber Cafe price for ${subService}: KSh ${price}`);
                    }
                }
            });
        });
    }
}

// Create global instance
window.dynamicPricing = new DynamicPricingManager();

// Auto-initialize based on page URL or data attributes
document.addEventListener('DOMContentLoaded', () => {
    // Try to detect service type from URL
    const path = window.location.pathname;
    let serviceType = null;

    if (path.includes('kra-services')) {
        serviceType = 'KRA';
    } else if (path.includes('sha-services')) {
        serviceType = 'SHA';
    } else if (path.includes('nssf-services')) {
        serviceType = 'NSSF';
    } else if (path.includes('ntsa-services')) {
        serviceType = 'NTSA';
    } else if (path.includes('helb-services')) {
        serviceType = 'HELB';
    } else if (path.includes('ghris-services')) {
        serviceType = 'GHRIS';
    } else if (path.includes('tsc-services')) {
        serviceType = 'TSC';
    } else if (path.includes('os-software-services')) {
        serviceType = 'OS_SOFTWARE';
    } else if (path.includes('computer-repair-services')) {
        serviceType = 'COMPUTER_REPAIR';
    }

    // Also check for data-service-type attribute on body or main container
    const serviceTypeAttr = document.body.getAttribute('data-service-type') || 
                           document.querySelector('[data-service-type]')?.getAttribute('data-service-type');
    
    if (serviceTypeAttr) {
        serviceType = serviceTypeAttr;
    }

    // Initialize if service type detected
    if (serviceType) {
        console.log(`Auto-detected service type: ${serviceType}`);
        window.dynamicPricing.init(serviceType);
    } else {
        console.log('No service type detected, skipping dynamic pricing initialization');
    }
});
