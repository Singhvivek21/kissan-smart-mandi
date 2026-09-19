/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * Centralized Authentic Agricultural Photography & Assets Configuration (js/images.js)
 * High-resolution, open-license authentic Indian agriculture photography
 * ==============================================================================
 */

const KISSAN_IMAGES = {
  // Hero & Primary Landing Photography
  hero: {
    farmerHarvest: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1200&q=80',
    alt: 'Indian farmer inspecting golden wheat harvest at Krishi Upaj Mandi'
  },
  // Mandi & Logistics Facilities
  mandi: {
    logisticsYard: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=1200&q=80',
    alt: 'Government Mandi grain collection centre and intake logistics facility',
    ruralMarket: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    alt: 'Agricultural produce market with sorted grain sacks'
  },
  // Crop Commodities
  crops: {
    wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    wheatAlt: 'Freshly harvested golden wheat grain produce',
    paddy: 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=800&q=80',
    paddyAlt: 'Paddy and rice crop cultivation field in India',
    mustard: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80',
    mustardAlt: 'Mustard crop field in Northern India',
    generalHarvest: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
    generalHarvestAlt: 'Panoramic Indian agricultural farmland during harvest season'
  },
  // Authentication & Officer Sidebars
  auth: {
    farmerSidebar: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80',
    farmerAlt: 'Indian farmer in agricultural field',
    officerSidebar: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80',
    officerAlt: 'Mandi APMC operations centre and weighbridge logistics facility'
  }
};

if (typeof window !== 'undefined') {
  window.KISSAN_IMAGES = KISSAN_IMAGES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KISSAN_IMAGES;
}
