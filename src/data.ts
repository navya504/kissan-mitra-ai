export const farmer = {
  name: 'Ramesh Kumar',
  village: 'Anakapalle',
  district: 'Visakhapatnam',
  state: 'Andhra Pradesh',
  crop: 'Paddy (Rice)',
  area: '10 acres',
  latitude: 17.69,
  longitude: 83.0,
};

// Forecast values are live: see src/forecast.ts and /api/weather.
export const weather = {
  location: 'Anakapalle, Andhra Pradesh',
};

export const marketPrices = [
  { market: 'Vijayawada', price: 2350, trend: '+3%' },
  { market: 'Visakhapatnam', price: 2200, trend: '+1%' },
  { market: 'Rajahmundry', price: 2280, trend: '+2%' },
  { market: 'Kakinada', price: 2250, trend: '+0%' },
];

export const schemes = [
  { name: 'PM-KISAN', detail: 'Direct income support for farmers', amount: '₹6,000 / year', icon: '🌾' },
  { name: 'PM Fasal Bima Yojana', detail: 'Crop insurance and loss protection', amount: 'Crop insurance', icon: '🌱' },
  { name: 'Drip Irrigation Subsidy', detail: 'Support for micro-irrigation systems', amount: 'Up to 55% subsidy', icon: '💧' },
];

export const initialTasks = [
  { id: 1, title: 'Irrigate South Field', note: 'Based on soil moisture data', priority: 'High' },
  { id: 2, title: 'Apply nitrogen fertilizer', note: 'Paddy plot #2', priority: 'High' },
  { id: 3, title: 'Inspect for leaf spot', note: 'North-east corner', priority: 'High' },
  { id: 4, title: 'Upload latest crop photos', note: 'Track crop health', priority: 'Medium' },
  { id: 5, title: 'Check soil moisture', note: 'Using sensor / manual check', priority: 'Medium' },
  { id: 6, title: 'Update market prices', note: 'Check for better selling opportunity', priority: 'Optional' },
  { id: 7, title: 'Complete PM-KISAN form', note: 'Deadline in 5 days', priority: 'Optional' },
];

export const discussions = [
  { name: 'Suresh Reddy', time: '1 hour ago', title: 'Best fertilizer for paddy?', body: 'I am seeing yellow leaves in my paddy. What fertilizer works best?', replies: 5, initials: 'SR' },
  { name: 'Lakshmi Devi', time: '3 hours ago', title: 'Pest control tips', body: 'How to control stem borer naturally?', replies: 12, initials: 'LD' },
  { name: 'Mahesh', time: '1 day ago', title: 'Good yield this season!', body: 'Sharing my experience on using organic fertilizers.', replies: 8, initials: 'M' },
];

export const navItems = [
  { label: 'Home', route: 'dashboard', icon: 'home' },
  { label: 'Scan', route: 'disease', icon: 'scan' },
  { label: 'Ask AI', route: 'assistant', icon: 'mic' },
  { label: 'Tasks', route: 'farm-plan', icon: 'check' },
  { label: 'More', route: 'more', icon: 'grid' },
];

export const screenMeta: Record<string, { title: string; subtitle: string }> = {
  splash: { title: 'Kisaan Mitra AI', subtitle: 'For farmers. For a brighter tomorrow.' },
  login: { title: 'Welcome to Kisaan Mitra AI', subtitle: 'Let’s grow together' },
  'profile-setup': { title: 'Tell us about you', subtitle: 'A few details help us personalize your recommendations.' },
  dashboard: { title: 'Good morning, Ramesh! 👋', subtitle: 'Healthy farms, prosperous lives' },
  'farm-plan': { title: 'Today’s Farm Plan', subtitle: 'Tuesday, 31 October 2026' },
  disease: { title: 'Crop Disease Detection', subtitle: 'Upload a photo of the affected plant part.' },
  weather: { title: 'Weather Advisory', subtitle: weather.location },
  map: { title: 'Farm Health Map', subtitle: 'Satellite view · Updated today' },
  yield: { title: 'Yield Prediction', subtitle: 'Paddy · Anakapalle' },
  market: { title: 'Market Price Intelligence', subtitle: 'Paddy (Rice) · Prices are sample data' },
  assistant: { title: 'Ask Kisaan Mitra AI', subtitle: 'Your personal farming assistant' },
  schemes: { title: 'Government Schemes', subtitle: 'Find and apply for schemes you may be eligible for' },
  notifications: { title: 'Notifications', subtitle: 'Farm updates and useful reminders' },
  community: { title: 'Farmer Community', subtitle: 'Learn. Share. Grow Together.' },
  profile: { title: 'My Profile', subtitle: 'Your farm details and preferences' },
  closing: { title: 'Together for a better tomorrow', subtitle: 'Empowering farmers with the power of AI' },
  more: { title: 'Explore Kisaan Mitra', subtitle: 'Your farm tools, all in one place' },
};
