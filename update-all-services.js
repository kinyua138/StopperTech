const fs = require('fs');
const path = require('path');

// List of service pages to update
const servicePages = [
    'nssf-services.html',
    'ntsa-services.html',
    'helb-services.html',
    'ghris-services.html',
    'tsc-services.html',
    'os-software-services.html',
    'computer-repair-services.html'
];

// Function to add dynamic pricing script to a service page
function addDynamicPricingToPage(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if dynamic pricing script is already added
        if (content.includes('js/dynamic-pricing.js')) {
            console.log(`✅ ${path.basename(filePath)} already has dynamic pricing`);
            return;
        }
        
        // Find the service form script section
        const serviceFormScriptPattern = /<!-- Service Form JavaScript -->\s*<script src="js\/service-form\.js"><\/script>/;
        
        if (serviceFormScriptPattern.test(content)) {
            // Add dynamic pricing script before service form script
            content = content.replace(
                serviceFormScriptPattern,
                `<!-- Dynamic Pricing JavaScript -->
    <script src="js/dynamic-pricing.js"></script>
    
    <!-- Service Form JavaScript -->
    <script src="js/service-form.js"></script>`
            );
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Added dynamic pricing to ${path.basename(filePath)}`);
        } else {
            console.log(`⚠️  Could not find service form script section in ${path.basename(filePath)}`);
        }
    } catch (error) {
        console.error(`❌ Error updating ${path.basename(filePath)}:`, error.message);
    }
}

// Update all service pages
console.log('🚀 Starting to update all service pages with dynamic pricing...\n');

servicePages.forEach(page => {
    const filePath = path.join(__dirname, 'frontend', page);
    if (fs.existsSync(filePath)) {
        addDynamicPricingToPage(filePath);
    } else {
        console.log(`⚠️  File not found: ${page}`);
    }
});

console.log('\n✨ Dynamic pricing update completed!');
