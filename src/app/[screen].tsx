import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Metadata } from 'expo-router/server';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Image, ImageBackground, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { C, S, Button, Card, Divider, Icon, Stat, Tag } from '../ui';
import { communityExperts, discussions, initialTasks, marketPrices, navItems, screenMeta, weather } from '../data';
import { useFarmProfile } from '../farm-profile';
import type { FarmProfileData } from '../farm-profile';
import { Assistant } from '../assistant';
import { CropScan } from '../crop-scan';
import FarmLocationPicker from '../components/FarmLocationPicker';
import { FarmMapPreview } from '../components/FarmMapPreview';
import { useLiveWeather } from '../hooks/useLiveWeather';
import { useLiveMarketPrices } from '../hooks/useLiveMarketPrices';
import { useGovernmentSchemes } from '../hooks/useGovernmentSchemes';
import { useSatelliteAnalysis } from '../hooks/useSatelliteAnalysis';
import { describeWeather } from '../services/weather';
import { languageOptions, LocalizedText as Text, LocalizedTextInput as TextInput, useLanguage } from '../i18n';
import farmerAvatar from '../../assets/farmer-avatar.png';
import farmerHero from '../../assets/farmer-field-hero.png';

const menu = [
  ['dashboard', 'Home', 'view-dashboard-outline'], ['farm-plan', 'Farm plan', 'calendar-check-outline'],
  ['disease', 'Crop scan', 'leaf'], ['weather', 'Weather', 'weather-partly-cloudy'],
  ['map', 'Farm health map', 'map-outline'], ['yield', 'Yield forecast', 'chart-box-outline'],
  ['market', 'Market prices', 'currency-inr'], ['assistant', 'Ask AI', 'robot-outline'],
  ['schemes', 'Govt schemes', 'bank-outline'], ['notifications', 'Notifications', 'bell-outline'],
  ['community', 'Community', 'account-group-outline'], ['profile', 'My profile', 'account-circle-outline'],
];

export function generateMetadata(): Metadata {
  return { title: 'Kisaan Mitra AI' };
}

export default function ScreenRoute() {
  const params = useLocalSearchParams<{ screen: string; returnTo?: string; openMap?: string }>();
  const screen = params.screen || 'dashboard';
  const { profile, setProfile } = useFarmProfile();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [tasks, setTasks] = useState(initialTasks.map(t => ({ ...t, done: false })));
  const [filter, setFilter] = useState('All');
  const [locationMode, setLocationMode] = useState('Satellite');

  const go = (route: string) => router.push(`/${route}` as any);
  const meta = screenMeta[screen] || screenMeta.more;
  const doneCount = tasks.filter(t => t.done).length;
  const showAppShell = !['splash', 'login', 'profile-setup', 'closing'].includes(screen);

  return (
    <View style={styles.root}>
      {showAppShell && desktop ? <View style={styles.sidebar}>
        <Pressable onPress={() => go('dashboard')} style={styles.brand}><View style={styles.brandMark}><Icon name="sprout" color={C.white} size={23} /></View><View><Text style={styles.brandName}>Kisaan Mitra</Text><Text style={styles.brandSub}>AI FARMING COMPANION</Text></View></Pressable>
        <Text style={styles.sideLabel}>YOUR FARM</Text>
        <ScrollView style={styles.sidebarMenu} contentContainerStyle={styles.sidebarMenuContent} showsVerticalScrollIndicator>
          {menu.map(([id, label, icon]) => <SideLink key={id} id={id} label={label} icon={icon} active={screen === id} onPress={go} />)}
        </ScrollView>
        <View style={styles.sidebarBottom}><Text style={{ color: '#c5d8c8', fontSize: 12 }}>🌱  Growing together</Text><Text style={{ color: '#a8c4ac', fontSize: 11, marginTop: 5 }}>{profile.village} · {profile.state}</Text></View>
      </View> : null}
      <View style={styles.main}>
        {showAppShell ? <View style={styles.topbar}>
          {!desktop ? <Pressable onPress={() => go('dashboard')} style={styles.brandMarkSmall}><Icon name="sprout" color={C.white} size={19} /></Pressable> : <Text style={styles.crumb}>FARM OVERVIEW <Text style={{ color: C.green }}> / {meta.title.toUpperCase()}</Text></Text>}
          {!desktop ? <Text style={styles.brandMobile}>Kisaan Mitra <Text style={{ color: C.green }}>AI</Text></Text> : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => go('notifications')} style={styles.bell}><Icon name="bell-outline" size={20} color={C.ink} /><View style={styles.bellDot} /></Pressable>
          {desktop ? <Pressable onPress={() => go('profile')} style={styles.avatar} accessibilityLabel={`Open ${profile.name || 'your'} profile`}><Text style={{ color: C.greenDark, fontWeight: '800' }}>{getInitials(profile.name)}</Text></Pressable> : null}
        </View> : null}

        <ScrollView contentContainerStyle={[S.content, desktop && styles.desktopContent, !showAppShell && styles.onboardContent]} showsVerticalScrollIndicator={false}>
          {showAppShell ? <View style={styles.pageHeading}><View style={{ flex: 1 }}><Text style={S.title}>{screen === 'dashboard' ? `Good morning, ${profile.name}! 👋` : meta.title}</Text><Text style={S.subtitle}>{meta.subtitle}</Text></View></View> : null}
          <View style={styles.screenBody}>
            {screen === 'splash' && <Splash go={go} />}
            {screen === 'login' && <Login go={go} />}
            {screen === 'profile-setup' && <ProfileSetup go={go} profile={profile} setProfile={setProfile} returnTo={params.returnTo === 'profile' ? 'profile' : 'dashboard'} openMapInitially={params.openMap === '1'} />}
            {screen === 'dashboard' && <Dashboard go={go} desktop={desktop} />}
            {screen === 'farm-plan' && <FarmPlan tasks={tasks} setTasks={setTasks} doneCount={doneCount} />}
            {screen === 'disease' && <CropScan go={go} />}
            {screen === 'weather' && <WeatherScreen go={go} />}
            {screen === 'map' && <MapScreen mode={locationMode} setMode={setLocationMode} go={go} />}
            {screen === 'yield' && <YieldScreen go={go} />}
            {screen === 'market' && <MarketScreen go={go} />}
            {screen === 'assistant' && <Assistant />}
            {screen === 'schemes' && <Schemes />}
            {screen === 'notifications' && <Notifications filter={filter} setFilter={setFilter} />}
            {screen === 'community' && <Community />}
            {screen === 'profile' && <Profile go={go} />}
            {screen === 'more' && <More go={go} />}
            {screen === 'closing' && <Closing go={go} />}
            {!screenMeta[screen] && <More go={go} />}
          </View>
          <Text style={styles.disclaimer}>Prototype with sample data · Advice should be confirmed with a local agriculture expert.</Text>
        </ScrollView>
        {showAppShell && !desktop ? <View style={styles.bottomNav}>{navItems.map(item => <Pressable key={item.route} onPress={() => go(item.route)} style={styles.bottomItem}><Icon name={item.icon === 'home' ? 'home-variant' : item.icon === 'scan' ? 'line-scan' : item.icon === 'mic' ? 'microphone-outline' : item.icon === 'check' ? 'checkbox-marked-circle-outline' : 'dots-horizontal'} size={20} color={screen === item.route ? C.green : C.muted} /><Text style={[styles.bottomText, screen === item.route && { color: C.green, fontWeight: '800' }]}>{item.label}</Text></Pressable>)}</View> : null}
      </View>
    </View>
  );
}

function SideLink({ id, label, icon, active, onPress }: { id: string; label: string; icon: string; active: boolean; onPress: (route: string) => void }) {
  return <Pressable onPress={() => onPress(id)} style={[styles.sideLink, active && styles.sideLinkActive]}><Icon name={icon} size={18} color={active ? '#f4fff3' : '#bed0c0'} /><Text style={[styles.sideLinkText, active && { color: C.white, fontWeight: '800' }]}>{label}</Text>{id === 'notifications' ? <View style={styles.sideBadge}><Text style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>2</Text></View> : null}</Pressable>;
}

function Splash({ go }: { go: (s: string) => void }) {
  return <View style={styles.splash}>
    <View style={styles.splashLogo}><Icon name="sprout" size={40} color={C.green} /></View>
    <Text style={styles.splashBrand}>Kisaan Mitra AI</Text><Text style={styles.splashTagline}>Smarter farms. Brighter tomorrows.</Text>
    <ImageBackground source={farmerHero} resizeMode="cover" style={styles.heroPhoto} imageStyle={{ borderRadius: 24 }}><View style={styles.heroPhotoCaption}><Text style={styles.heroCaptionTitle}>Good things grow here.</Text><Text style={styles.heroCaptionBody}>A farming companion, rooted in your everyday.</Text></View></ImageBackground>
    <View style={styles.splashPerks}><Text style={styles.perk}>✦  AI insights</Text><Text style={styles.perk}>✦  Better yields</Text><Text style={styles.perk}>✦  Happier farmers</Text></View>
    <Button title="Get started" icon="arrow-right" onPress={() => go('login')} style={{ width: '100%', maxWidth: 360, marginTop: 22 }} />
    <View style={{ alignItems: 'center', marginTop: 14 }}><LanguageSelector /></View>
  </View>;
}

function Login({ go }: { go: (s: string) => void }) {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const sendOtp = () => {
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setError('');
    setOtp('');
    setVerificationCode(String(Math.floor(100000 + Math.random() * 900000)));
    setShowOtp(true);
  };
  const verifyOtp = () => {
    if (otp.length !== 6 || otp !== verificationCode) {
      setError('That code does not match. Check the message and try again.');
      return;
    }
    setError('');
    setShowOtp(false);
    go('profile-setup');
  };

  return <View style={styles.onboardWrap}><View style={styles.onboardIcon}><Icon name="sprout" size={30} color={C.green} /></View><Text style={[S.title, { textAlign: 'center' }]}>Welcome to Kisaan Mitra AI</Text><Text style={[S.subtitle, { textAlign: 'center', marginBottom: 24 }]}>Let’s grow together</Text>
    <Card style={{ width: '100%', maxWidth: 430 }}><Text style={styles.inputLabel}>Mobile number</Text><View style={styles.phoneInput}><Text style={{ color: C.ink, fontWeight: '700' }}>+91</Text><TextInput value={mobile} onChangeText={value => { setMobile(value.replace(/\D/g, '').slice(0, 10)); setError(''); }} placeholder="Enter 10-digit number" keyboardType="number-pad" maxLength={10} style={styles.input} /></View>{error && !showOtp ? <Text style={styles.authError}>{error}</Text> : null}<Button title="Get verification code" icon="message-text-outline" onPress={sendOtp} style={{ marginTop: 14 }} /><Text style={[S.muted, { textAlign: 'center', marginTop: 12 }]}>Enter the verification code to continue.</Text></Card>
    <Text style={[S.muted, { textAlign: 'center', marginTop: 18, maxWidth: 380 }]}>Use your 10-digit mobile number to sign in.</Text>
    <Modal visible={showOtp} transparent animationType="slide" onRequestClose={() => setShowOtp(false)}><View style={styles.otpBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOtp(false)} /><View style={styles.otpPopup}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Verification code</Text><Pressable onPress={() => setShowOtp(false)} accessibilityLabel="Close verification pop-up"><Icon name="close" size={21} color={C.muted} /></Pressable></View><Text style={[S.muted, { marginTop: 5 }]}>For +91 {mobile}</Text><View style={styles.verificationMessage}><Icon name="message-text-outline" color={C.green} /><Text style={styles.verificationMessageText}>Your Kisaan Mitra verification code is <Text style={{ fontWeight: '900', letterSpacing: 2 }}>{verificationCode}</Text></Text></View><Text style={styles.inputLabel}>Enter the 6-digit code</Text><TextInput value={otp} onChangeText={value => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="000000" keyboardType="number-pad" maxLength={6} style={styles.otpInput} autoFocus />{error ? <Text style={styles.authError}>{error}</Text> : null}<Button title="Verify and continue" icon="check" onPress={verifyOtp} style={{ marginTop: 12 }} /></View></View></Modal>
  </View>;
}

const statesOfIndia = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const districtSuggestions: Record<string, string[]> = {
  'Andhra Pradesh': ['Alluri Sitharama Raju', 'Anakapalli', 'Anantapur', 'Annamayya', 'Bapatla', 'Chittoor', 'East Godavari', 'Eluru', 'Guntur', 'Kakinada', 'Krishna', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Srikakulam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  Telangana: ['Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahabubnagar', 'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddy', 'Sangareddy', 'Warangal'],
  Karnataka: ['Bagalkot', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Dharwad', 'Kalaburagi', 'Mysuru', 'Shivamogga', 'Tumakuru'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Thanjavur', 'Tiruchirappalli', 'Tirunelveli', 'Vellore'],
  Maharashtra: ['Ahmednagar', 'Chhatrapati Sambhajinagar', 'Kolhapur', 'Nagpur', 'Nashik', 'Pune', 'Solapur'],
  Kerala: ['Ernakulam', 'Idukki', 'Kollam', 'Kozhikode', 'Palakkad', 'Thiruvananthapuram', 'Thrissur'],
};

function ProfileSetup({ go, profile, setProfile, returnTo, openMapInitially }: { go: (s: string) => void; profile: FarmProfileData; setProfile: (profile: FarmProfileData) => void; returnTo: string; openMapInitially: boolean }) {
  const blankProfile: FarmProfileData = { name: '', state: '', district: '', village: '', crop: '', area: '', location: '', latitude: '', longitude: '' };
  const [draft, setDraft] = useState(returnTo === 'profile' ? profile : blankProfile);
  const [mapOpen, setMapOpen] = useState(openMapInitially);
  const [formError, setFormError] = useState('');
  const update = (key: keyof FarmProfileData, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const save = () => {
    const cleaned = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as FarmProfileData;
    if (!cleaned.name || !cleaned.state || !cleaned.district || !cleaned.village || !cleaned.crop || !cleaned.area) {
      setFormError('Please enter your name, state, district, village, farm area, and main crop.');
      return;
    }
    if (!/^\d+(\.\d+)?\s*(acres?|hectares?|ha)?$/i.test(cleaned.area)) {
      setFormError('Enter a valid farm area, such as 2 acres or 0.8 hectares.');
      return;
    }
    if (!cleaned.latitude || !cleaned.longitude) {
      setFormError('Tap the map pin, move it to your farm, then choose “Use this pin.”');
      return;
    }
    setFormError('');
    setProfile({ ...cleaned, location: [cleaned.village, cleaned.district, cleaned.state].join(', ') });
    go(returnTo);
  };
  return <View style={styles.onboardWrap}><Text style={[S.title, { textAlign: 'center' }]}>Tell us about your farm</Text><Text style={[S.subtitle, { textAlign: 'center', marginBottom: 20 }]}>Enter your details. You can update them later from My Profile.</Text><Card style={{ width: '100%', maxWidth: 500 }}>
    <InputRow label="Full name" value={draft.name} onChangeText={value => { update('name', value); setFormError(''); }} placeholder="Enter your name" />
    <SelectRow label="State" value={draft.state} placeholder="Select your state" options={statesOfIndia} onSelect={value => { setDraft(current => ({ ...current, state: value, district: '', village: '', location: '', latitude: '', longitude: '' })); setFormError(''); }} />
    <SelectRow label="District" value={draft.district} placeholder={draft.state ? 'Select or search for your district' : 'Select a state first'} options={districtSuggestions[draft.state] ?? []} disabled={!draft.state} onSelect={value => { setDraft(current => ({ ...current, district: value, village: '', location: '', latitude: '', longitude: '' })); setFormError(''); }} />
    <SelectRow label="Village" value={draft.village} placeholder={draft.district ? 'Select or enter your village' : 'Select a district first'} options={draft.village ? [draft.village] : []} disabled={!draft.district} onSelect={value => { setDraft(current => ({ ...current, village: value, location: '', latitude: '', longitude: '' })); setFormError(''); }} />
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><InputRow label="Farm area" value={draft.area} onChangeText={value => { update('area', value); setFormError(''); }} placeholder="e.g. 2 acres" /></View><View style={{ flex: 1 }}><InputRow label="Main crop" value={draft.crop} onChangeText={value => { update('crop', value); setFormError(''); }} placeholder="e.g. Paddy" /></View></View>
    <Card style={styles.locationCard}><Icon name="map-marker" size={18} color={C.green} /><View style={{ flex: 1 }}><Text style={styles.inputLabel}>Farm location</Text><Text style={S.muted}>{[draft.village, draft.district, draft.state].filter(Boolean).join(', ') || 'Select village, district, and state'}</Text>{draft.latitude && draft.longitude ? <Text style={[S.muted, { marginTop: 3 }]}>{draft.latitude}, {draft.longitude}</Text> : <Text style={[S.muted, { marginTop: 3 }]}>Tap the pin to set your exact field location.</Text>}</View><Pressable onPress={() => { setFormError(''); setMapOpen(true); }} accessibilityRole="button" accessibilityLabel="Choose farm location on map" hitSlop={10} style={{ padding: 5 }}><Icon name="map-marker-check-outline" size={21} color={C.green} /></Pressable></Card>
    {formError ? <Text accessibilityRole="alert" style={styles.formError}>{formError}</Text> : null}
    <Button title={returnTo === 'profile' ? 'Save farm details' : 'Continue to my farm'} icon="arrow-right" onPress={save} style={{ marginTop: 16 }} />
  </Card>
    <Modal visible={mapOpen} transparent animationType="slide" onRequestClose={() => setMapOpen(false)}>
      <View style={styles.mapPickerBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setMapOpen(false)} /><View style={styles.mapPickerPopup}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Choose farm location</Text><Pressable onPress={() => setMapOpen(false)} accessibilityLabel="Close map picker"><Icon name="close" size={22} color={C.muted} /></Pressable></View><FarmLocationPicker state={draft.state} initialLatitude={draft.latitude ? Number(draft.latitude) : undefined} initialLongitude={draft.longitude ? Number(draft.longitude) : undefined} area={draft.area} onSelect={point => { setDraft(current => ({ ...current, latitude: point.latitude.toFixed(6), longitude: point.longitude.toFixed(6) })); setFormError(''); setMapOpen(false); }} /></View></View>
    </Modal>
  </View>;
}

function InputRow({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={{ marginBottom: 13 }}><Text style={styles.inputLabel}>{label}</Text><View style={styles.field}><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a6b0a4" style={styles.profileInput} /></View></View>;
}

function SelectRow({ label, value, placeholder, options, onSelect, disabled = false }: { label: string; value: string; placeholder: string; options: string[]; onSelect: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  const select = (option: string) => { onSelect(option); setOpen(false); setQuery(''); };
  return <View style={{ marginBottom: 13 }}><Text style={styles.inputLabel}>{label}</Text><Pressable disabled={disabled} onPress={() => { setQuery(value); setOpen(true); }} accessibilityRole="button" style={[styles.selectField, disabled && { opacity: 0.55 }]}><Text style={[value ? S.body : S.muted, { flex: 1 }]}>{value || placeholder}</Text><Icon name="chevron-down" size={19} color={C.muted} /></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={styles.languageBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><View style={styles.selectPopup}><View style={styles.rowBetween}><Text style={S.sectionTitle}>{label}</Text><Pressable onPress={() => { setOpen(false); setQuery(''); }} accessibilityLabel="Close picker"><Icon name="close" size={21} color={C.muted} /></Pressable></View><TextInput value={query} onChangeText={setQuery} placeholder={`Search or enter ${label.toLowerCase()}`} autoFocus style={styles.selectSearch} />
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>{filtered.map(option => <Pressable key={option} onPress={() => select(option)} style={styles.selectOption}><Text style={S.body}>{option}</Text>{option === value ? <Icon name="check" color={C.green} /> : null}</Pressable>)}{query.trim() && !options.some(option => option.toLowerCase() === query.trim().toLowerCase()) ? <Pressable onPress={() => select(query.trim())} style={[styles.selectOption, styles.selectCustom]}><Icon name="plus-circle-outline" color={C.green} /><Text style={[S.body, { flex: 1 }]}>Use “{query.trim()}”</Text></Pressable> : null}{filtered.length === 0 && !query.trim() ? <Text style={[S.muted, { paddingVertical: 18, textAlign: 'center' }]}>Type to search or enter a place name.</Text> : null}</ScrollView>
    </View></View></Modal>
  </View>;
}

function Dashboard({ go, desktop }: { go: (s: string) => void; desktop: boolean }) {
  const { profile } = useFarmProfile();
  const liveWeather = useLiveWeather();
  const liveMarket = useLiveMarketPrices();
  const liveSchemes = useGovernmentSchemes();
  const wx = liveWeather.data;
  const weatherDescription = wx ? describeWeather(wx.code).label : weather.condition;
  const hasLiveMarketPrice = Boolean(liveMarket.data?.prices.length);
  const marketValue = liveMarket.data?.prices[0]?.modalPrice ?? marketPrices[0].price;
  const relevantSchemes = liveSchemes.data?.schemes.filter(scheme => scheme.relevant) ?? [];
  return <View style={styles.stack}><View style={[styles.rowBetween, { alignSelf: 'flex-end' }]}><LanguageSelector /></View>
    <Card style={styles.welcomeCard}><View style={{ flex: 1 }}><Tag>YOUR FARM TODAY</Tag><Text style={{ color: C.white, fontSize: 23, fontWeight: '800', marginTop: 13 }}>Good morning, {profile.name}!</Text><View style={{ marginTop: 5 }}><Text style={{ color: '#d6e8d7', fontSize: 13, lineHeight: 19 }}>Village: {profile.village || 'Not set'}</Text><Text style={{ color: '#d6e8d7', fontSize: 13, lineHeight: 19 }}>Crop: {formatCrop(profile.crop)}</Text><Text style={{ color: '#d6e8d7', fontSize: 13, lineHeight: 19 }}>Land area: {formatFarmArea(profile.area)}</Text></View><Button title="Open today’s farm plan" secondary icon="arrow-right" onPress={() => go('farm-plan')} style={{ marginTop: 20, alignSelf: 'flex-start' }} /></View><Image source={farmerAvatar} resizeMode="cover" style={styles.farmerHeroPortrait} /></Card>
    <View style={[styles.rowWrap, desktop && { flexWrap: 'nowrap' }]}><Card style={[styles.weatherCard, { flex: 1.2 }]}><View style={styles.rowBetween}><View><Text style={styles.cardEyebrow}>{profile.location || `${profile.village}, ${profile.state}`}</Text><Text style={{ color: C.ink, fontSize: 17, fontWeight: '800', marginTop: 5 }}>{wx?.days[1]?.rainChance && wx.days[1].rainChance >= 40 ? `Rain likely tomorrow · ${wx.days[1].rainChance}%` : wx ? 'Forecast updated for your farm' : weather.rain}</Text><Text style={S.muted}>{liveWeather.error || (liveWeather.loading ? 'Loading local forecast…' : wx ? 'Open-Meteo · live forecast' : 'Sample forecast')}</Text></View><Text style={{ fontSize: 40 }}>{wx ? describeWeather(wx.code).icon : '🌤️'}</Text></View><View style={styles.tempRow}><Text style={styles.temp}>{wx?.temperature ?? weather.temperature}°</Text><View><Text style={S.body}>{weatherDescription}</Text><Text style={S.muted}>Feels like {wx?.feelsLike ?? 30}°</Text></View></View><Button title="View weather" secondary icon="weather-partly-cloudy" onPress={() => go('weather')} /></Card>
      <Card style={{ flex: 1, minWidth: 240 }}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Farm health</Text><Tag>GOOD</Tag></View><View style={styles.healthLine}><Text style={styles.healthScore}>85</Text><Text style={{ color: C.muted, fontSize: 18 }}>/100</Text><View style={{ flex: 1, height: 10, backgroundColor: '#edf1e8', borderRadius: 9, marginLeft: 12 }}><View style={{ width: '85%', height: '100%', backgroundColor: C.green, borderRadius: 9 }} /></View></View><Text style={S.muted}>Your crop is looking healthy this week.</Text><Button title="Open farm health map" secondary icon="map-outline" onPress={() => go('map')} style={{ marginTop: 15 }} /></Card></View>
    <View style={styles.statsRow}><Stat label="Expected yield" value="4.8 t/ac" detail="↑ 8% vs last season" icon="sprout" /><Stat label="Market price" value={`₹${marketValue.toLocaleString('en-IN')}`} detail={`per quintal · ${hasLiveMarketPrice ? 'data.gov.in' : 'sample'}`} icon="currency-inr" color={C.gold} /><Stat label="Today’s tasks" value="3 / 7" detail="3 high priority" icon="clipboard-check-outline" color={C.orange} /><Stat label="Schemes to review" value={liveSchemes.loading ? '…' : String(relevantSchemes.length)} detail="Based on state and crop" icon="bank-outline" color={C.blue} /></View>
    <View style={styles.rowWrap}><Card style={{ flex: 1.3 }}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Today’s farm plan</Text><Pressable onPress={() => go('farm-plan')}><Text style={styles.link}>See all →</Text></Pressable></View><Text style={[S.muted, { marginTop: 4 }]}>Your most important next steps</Text><TaskPreview title="Irrigate South Field" note="Based on soil moisture data" /><TaskPreview title="Inspect for leaf spot" note="Disease risk increased nearby" /></Card>
      <Card style={{ flex: 1, minWidth: 240 }}><Text style={S.sectionTitle}>Farm copilot</Text><Text style={[S.body, { marginTop: 9 }]}>Need a hand with your crop today?</Text><Text style={[S.muted, { marginTop: 3 }]}>Ask a question by text or voice.</Text><Button title="Ask Kisaan Mitra AI" icon="microphone-outline" onPress={() => go('assistant')} style={{ marginTop: 15 }} /><Button title="Scan a crop leaf" secondary icon="camera-outline" onPress={() => go('disease')} style={{ marginTop: 9 }} /></Card></View>
    <Card><View style={styles.rowBetween}><View><Text style={S.sectionTitle}>Government schemes</Text><Text style={S.muted}>Relevant to your state and crop · check eligibility</Text></View><Pressable onPress={() => go('schemes')}><Text style={styles.link}>View all →</Text></Pressable></View><View style={styles.schemeStrip}>{relevantSchemes.slice(0, 3).map(scheme => <View key={scheme.id} style={styles.schemeMini}><Text style={{ fontSize: 24 }}>{scheme.category === 'Crop insurance' ? '🌱' : scheme.category === 'Soil testing' ? '🧪' : '🌾'}</Text><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{scheme.name}</Text><Text style={S.muted}>{scheme.category}</Text></View><Tag>RELEVANT</Tag></View>)}{liveSchemes.error ? <Text style={S.muted}>{liveSchemes.error}</Text> : null}{!liveSchemes.loading && !liveSchemes.error && relevantSchemes.length === 0 ? <Text style={S.muted}>Open schemes to review available programmes.</Text> : null}</View></Card>
    <Card style={{ backgroundColor: '#f0f6ed' }}><View style={styles.rowBetween}><View style={{ flexDirection: 'row', gap: 10, flex: 1 }}><Icon name="lightbulb-on-outline" size={20} color={C.green} /><View style={{ flex: 1 }}><Text style={styles.itemTitle}>AI advisory</Text><Text style={S.muted}>Rain is likely tomorrow. Consider moving pesticide application to today.</Text></View></View><Button title="See alerts" secondary onPress={() => go('notifications')} /></View></Card>
  </View>;
}

function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = languageOptions.find(option => option.id === language) ?? languageOptions[0];
  return <><Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Select language" style={styles.languageButton}><Icon name="translate" size={18} color={C.green} /><Text style={{ color: C.greenDark, fontSize: 13, fontWeight: '800' }}>{selected.label}  ⌄</Text></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={styles.languageBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><View style={styles.languagePopup}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Select language</Text><Pressable onPress={() => setOpen(false)} accessibilityLabel="Close language picker"><Icon name="close" size={21} color={C.muted} /></Pressable></View><Text style={[S.muted, { marginTop: 5, marginBottom: 12 }]}>Changing the language updates the app screens.</Text>{languageOptions.map(option => <Pressable key={option.id} onPress={() => { setLanguage(option.id); setOpen(false); }} style={[styles.languageOption, option.id === language && styles.languageOptionSelected]}><Text style={[styles.itemTitle, { fontSize: 15 }]}>{option.nativeName}</Text>{option.id === language ? <Icon name="check" size={19} color={C.green} /> : null}</Pressable>)}</View></View></Modal>
  </>;
}

function TaskPreview({ title, note }: { title: string; note: string }) { return <View style={styles.taskPreview}><View style={styles.taskBullet} /><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{title}</Text><Text style={S.muted}>{note}</Text></View><Icon name="chevron-right" color={C.muted} /></View>; }

function FarmPlan({ tasks, setTasks, doneCount }: { tasks: any[]; setTasks: (t: any) => void; doneCount: number }) {
  const { profile } = useFarmProfile();
  const [tab, setTab] = useState('Tasks');
  return <View style={styles.stack}><Card><View style={styles.rowBetween}><View><Text style={S.sectionTitle}>Your plan, one step at a time</Text><Text style={S.muted}>Personalized for {profile.crop} · {profile.village}</Text></View><Tag>{doneCount}/{tasks.length} DONE</Tag></View><Divider /><View style={styles.segment}>{['Tasks', 'Calendar'].map(t => <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && styles.segmentActive]}><Text style={[styles.segmentText, tab === t && { color: C.greenDark }]}>{t}</Text></Pressable>)}</View>
    {tab === 'Calendar' ? <View style={{ paddingVertical: 35, alignItems: 'center' }}><Text style={{ fontSize: 32 }}>🗓️</Text><Text style={[S.sectionTitle, { marginTop: 8 }]}>Your week at a glance</Text><Text style={[S.muted, { textAlign: 'center', marginTop: 6 }]}>7 suggested tasks this week · Tap Tasks to check items off.</Text></View> : <View style={{ gap: 18, marginTop: 15 }}>{['High', 'Medium', 'Optional'].map(priority => <View key={priority}><View style={styles.priorityHeading}><Text style={styles.itemTitle}>{priority} priority</Text><Tag tone={priority === 'High' ? 'red' : priority === 'Medium' ? 'gold' : 'green'}>{tasks.filter(t => t.priority === priority && !t.done).length} TASKS</Tag></View>{tasks.filter(t => t.priority === priority).map(task => <Pressable key={task.id} onPress={() => setTasks((old: any[]) => old.map(t => t.id === task.id ? { ...t, done: !t.done } : t))} style={styles.taskRow}><Icon name={task.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={23} color={task.done ? C.green : priority === 'High' ? C.red : C.muted} /><View style={{ flex: 1 }}><Text style={[styles.itemTitle, task.done && { textDecorationLine: 'line-through', color: C.muted }]}>{task.title}</Text><Text style={S.muted}>{task.note}</Text></View><Icon name="chevron-right" color={C.muted} /></Pressable>)}</View>)}</View>}</Card></View>;
}

function WeatherScreen({ go }: { go: (s: string) => void }) {
  const { data, loading, error, refresh } = useLiveWeather();
  const currentDescription = data ? describeWeather(data.code) : { label: weather.condition, icon: '🌤️' };
  const days = data?.days.map((day, index) => ({
    label: index === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
    high: day.high,
    low: day.low,
    rainChance: day.rainChance,
    icon: describeWeather(day.code).icon,
  })) ?? weather.days.map(([label, temp, icon]) => ({ label, high: Number.parseInt(temp, 10), low: 23, rainChance: 0, icon }));
  const rainTomorrow = days[1]?.rainChance ?? 0;
  return <View style={styles.stack}><Card style={styles.weatherHero}><View style={styles.rowBetween}><View><Text style={{ color: '#e0f0df', fontSize: 13 }}>{weather.location}</Text><Text style={{ color: C.white, fontSize: 19, fontWeight: '800', marginTop: 9 }}>{currentDescription.label}</Text><Text style={{ color: C.white, fontSize: 45, fontWeight: '800' }}>{data?.temperature ?? weather.temperature}°C</Text></View><Text style={{ fontSize: 65 }}>{currentDescription.icon}</Text></View><View style={styles.rowWrap}><View style={styles.weatherInfo}><Icon name="weather-rainy" color="#d7efd8" /><Text style={{ color: C.white, fontSize: 12 }}>{data ? `Tomorrow rain ${rainTomorrow}%` : 'Sample rain outlook'}</Text></View><View style={styles.weatherInfo}><Icon name="water-percent" color="#d7efd8" /><Text style={{ color: C.white, fontSize: 12 }}>Humidity {data?.humidity ?? 68}%</Text></View><View style={styles.weatherInfo}><Icon name="weather-windy" color="#d7efd8" /><Text style={{ color: C.white, fontSize: 12 }}>Wind {data?.wind ?? 12} km/h</Text></View></View></Card>
    <Card><View style={styles.rowBetween}><View><Text style={S.sectionTitle}>7-day forecast</Text><Text style={[S.muted, { marginTop: 3 }]}>{data ? `Live forecast · Updated ${data.updatedAt.replace('T', ' ').slice(0, 16)} IST` : loading ? 'Loading local forecast…' : 'Sample forecast · Check local conditions before field work.'}</Text></View><Pressable onPress={() => void refresh()}><Text style={styles.link}>Refresh</Text></Pressable></View>{error ? <Text style={[S.muted, { marginTop: 8 }]}>{error}</Text> : null}<View style={{ marginTop: 10 }}>{days.map(day => <View key={day.label} style={styles.forecastRow}><Text style={[styles.itemTitle, { width: 70 }]}>{day.label}</Text><Text style={{ fontSize: 22, flex: 1 }}>{day.icon}</Text><Text style={[S.body, { width: 74, textAlign: 'right' }]}>{day.high}° / {day.low}°</Text><Text style={[S.muted, { width: 90, textAlign: 'right' }]}>{day.rainChance}% rain</Text></View>)}</View></Card>
    <Card><Text style={S.sectionTitle}>Weather advisory</Text>{data && rainTomorrow >= 40 ? <AlertRow tone="red" icon="weather-pouring" title={`Rain likely tomorrow · ${rainTomorrow}%`} body="Consider postponing pesticide spraying. Secure harvested grain if rain is expected." /> : <AlertRow tone="green" icon="weather-partly-cloudy" title={data ? 'No high-rain alert for tomorrow' : 'Sample advisory'} body={data ? 'Check the latest local conditions before spraying or irrigation.' : 'Live rain alerts will appear when the forecast is available.'} />}{data && days.some(day => day.high >= 35) ? <AlertRow tone="gold" icon="weather-sunny-alert" title="High temperatures in the forecast" body="Water crops during cooler morning hours to reduce evaporation." /> : null}</Card><Button title="Open today’s farm plan" icon="calendar-check-outline" onPress={() => go('farm-plan')} /></View>;
}

function AlertRow({ tone, icon, title, body }: { tone: 'red' | 'gold' | 'green'; icon: string; title: string; body: string }) { const color = tone === 'red' ? C.red : tone === 'gold' ? C.orange : C.green; return <View style={styles.alertRow}><View style={[styles.alertIcon, { backgroundColor: tone === 'red' ? C.redSoft : tone === 'gold' ? '#fff5dc' : C.greenSoft }]}><Icon name={icon} size={20} color={color} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{title}</Text><Text style={S.muted}>{body}</Text></View></View>; }

function formatCrop(crop: string) {
  const value = crop.trim();
  return value ? value[0].toLocaleUpperCase() + value.slice(1) : 'Not set';
}

function formatFarmArea(area: string) {
  const value = area.trim();
  if (!value) return 'Not set';
  return /\b(ac|acre|acres|hectare|hectares|ha)\b/i.test(value) ? value : `${value} acres`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() : '?';
}

function MapScreen({ mode, setMode, go }: { mode: string; setMode: (s: string) => void; go: (s: string) => void }) {
  const { profile, setProfile } = useFarmProfile();
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const analysis = useSatelliteAnalysis({ latitude: profile.latitude, longitude: profile.longitude, area: profile.area });
  const savedLat = Number(profile.latitude);
  const savedLng = Number(profile.longitude);
  const hasPreciseLocation = Number.isFinite(savedLat) && Number.isFinite(savedLng) && Boolean(profile.latitude && profile.longitude);
  const latitude = hasPreciseLocation ? savedLat : 17.69134;
  const longitude = hasPreciseLocation ? savedLng : 83.00395;
  const selectedMode = mode === 'Map' ? 'Map' : 'Satellite';
  return <View style={styles.stack}><Card><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={S.sectionTitle}>Your farm location</Text><Text style={S.muted}>{[profile.village, profile.district, profile.state].filter(Boolean).join(', ') || profile.location}</Text></View><View style={styles.segment}>{(['Map', 'Satellite'] as const).map(v => <Pressable onPress={() => setMode(v)} key={v} style={[styles.segmentItem, selectedMode === v && styles.segmentActive]}><Text style={[styles.segmentText, selectedMode === v && { color: C.greenDark }]}>{v}</Text></Pressable>)}</View></View>
    <FarmMapPreview latitude={latitude} longitude={longitude} mode={selectedMode} locationLabel={hasPreciseLocation ? 'Farm pin' : 'Approximate village location'} area={profile.area} />
    <View style={styles.mapLocationLine}><Icon name="crosshairs-gps" size={16} color={C.green} /><Text style={S.muted}>{hasPreciseLocation ? `${savedLat.toFixed(5)}, ${savedLng.toFixed(5)}` : 'Choose a precise farm pin before running satellite analysis.'}</Text></View>
    <View style={{ flexDirection: 'row', gap: 9, marginTop: 12, flexWrap: 'wrap' }}><Button title="Update farm pin" secondary icon="map-marker-outline" onPress={() => setPinPickerOpen(true)} /><Button title="Analyze crop vigor" icon="satellite-variant" onPress={() => void analysis.refresh()} /></View>
    {analysis.loading ? <Text style={[S.muted, { marginTop: 12 }]}>Looking for usable Sentinel-2 imagery over the estimated field…</Text> : null}
    {analysis.error ? <View style={styles.satelliteNotice}><Icon name="information-outline" size={18} color={C.gold} /><Text style={[S.muted, { flex: 1 }]}>{analysis.error}</Text></View> : null}
    {analysis.data?.latest ? <><View style={styles.satelliteScore}><View style={styles.yieldIcon}><Icon name="leaf" size={21} color={C.green} /></View><View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>HOW GREEN YOUR FIELD LOOKS FROM SPACE</Text><Text style={[styles.itemTitle, { fontSize: 19, marginTop: 3 }]}>{analysis.data.latest.vigorScore} / 100</Text><Text style={S.muted}>NDVI {analysis.data.latest.ndvi.toFixed(2)} · observed {new Date(analysis.data.latest.date).toLocaleDateString()}</Text></View><Tag>{analysis.data.latest.changeFromPrevious === null ? 'FIRST PASS' : analysis.data.latest.changeFromPrevious >= 0 ? 'TREND UP' : 'TREND DOWN'}</Tag></View><Text style={[S.body, { marginTop: 12 }]}>NDVI compares how plants reflect different kinds of light. In simple terms, it estimates how much green vegetation the satellite can see in your mapped field. A lower reading can happen when a crop is young, after harvest, when soil or water is visible, or when plants may be under stress. Check the crop’s growth stage and look at the field before deciding what action to take.</Text></> : null}
    </Card>
    {analysis.data ? <Card style={{ backgroundColor: '#f1f6ee' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name="satellite-variant" color={C.green} size={20} /><Text style={styles.itemTitle}>How the satellite check works</Text></View>{analysis.data.latest ? <><Text style={[S.body, { marginTop: 8 }]}>Sentinel-2 takes pictures of the Earth. We check clear image points inside your estimated field.</Text><Text style={[S.body, { marginTop: 6 }]}>Estimated field: {analysis.data.fieldAreaAcres} acres · Clear image points used: {analysis.data.latest.validPixels.toLocaleString()}</Text><Text style={[S.body, { marginTop: 6 }]}>Cloudy or missing images are left out. Your boundary is estimated from the map pin and land area, so it may not match an irregular field exactly.</Text></> : <Text style={[S.body, { marginTop: 8 }]}>No clear satellite image points were available for this estimated field in the selected period. Cloud cover can block a reading; try again after another satellite pass.</Text>}<Text style={[S.muted, { marginTop: 8 }]}>This reading shows plant greenness. It cannot identify a disease or confirm the cause of a crop problem.</Text></Card> : <Card style={{ backgroundColor: '#f1f6ee' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name="satellite-variant" color={C.green} size={20} /><Text style={styles.itemTitle}>Estimated field boundary</Text></View><Text style={[S.muted, { marginTop: 7 }]}>A square boundary is calculated from the saved map pin and farm area. Confirm it against the real field: a pin and area cannot describe irregular field edges or multiple plots.</Text></Card>}
    {analysis.data && analysis.data.observations.length > 1 ? <Card><Text style={S.sectionTitle}>How the vegetation changed over 90 days</Text><Text style={[S.body, { marginTop: 5 }]}>Each bar is the average NDVI reading for a 10-day period. A taller bar means the satellite saw a stronger green-vegetation signal in that period. Look at the pattern across dates; cloud cover and normal crop growth stages can also change the readings.</Text><Text style={[S.muted, { marginTop: 5 }]}>Cloudy or missing observations are left out.</Text><View style={styles.ndviChart}>{analysis.data.observations.slice(-9).map(point => <View key={point.date} style={styles.ndviColumn}><Text style={styles.ndviValue}>{point.ndvi.toFixed(2)}</Text><View style={[styles.ndviBar, { height: `${Math.max(4, Math.min(100, Math.round(Math.max(0, point.ndvi) * 100)))}%` }]} /><Text style={styles.ndviDate}>{new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View>)}</View></Card> : null}
    <Modal visible={pinPickerOpen} transparent animationType="fade" onRequestClose={() => setPinPickerOpen(false)}><View style={styles.mapPickerBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setPinPickerOpen(false)} /><View style={styles.mapPickerPopup}><View style={styles.rowBetween}><Text style={S.sectionTitle}>Update farm pin</Text><Pressable onPress={() => setPinPickerOpen(false)} accessibilityLabel="Close farm pin picker"><Icon name="close" size={22} color={C.muted} /></Pressable></View><FarmLocationPicker state={profile.state} initialLatitude={hasPreciseLocation ? savedLat : undefined} initialLongitude={hasPreciseLocation ? savedLng : undefined} area={profile.area} onSelect={point => { setProfile({ ...profile, latitude: point.latitude.toFixed(6), longitude: point.longitude.toFixed(6) }); setPinPickerOpen(false); }} /></View></View></Modal>
    </View>;
}

function YieldScreen({ go }: { go: (s: string) => void }) {
  const { profile } = useFarmProfile();
  const satellite = useSatelliteAnalysis({ latitude: profile.latitude, longitude: profile.longitude, area: profile.area });
  const market = useLiveMarketPrices(profile.state);
  const [yieldPerAcre, setYieldPerAcre] = useState('4.8');
  const areaMatch = profile.area.match(/[\d.]+/);
  const enteredArea = areaMatch ? Number(areaMatch[0]) : 0;
  const area = /hectare|\bha\b/i.test(profile.area) ? enteredArea * 2.47105 : enteredArea;
  const perAcre = Number(yieldPerAcre);
  const validYield = Number.isFinite(perAcre) && perAcre > 0;
  const totalLow = validYield && area > 0 ? perAcre * area * 0.9 : 0;
  const totalHigh = validYield && area > 0 ? perAcre * area * 1.1 : 0;
  const isPaddy = /paddy|rice/i.test(profile.crop);
  const pricePerQuintal = isPaddy ? market.data?.prices.find(item => item.modalPrice > 0)?.modalPrice : undefined;
  const rupees = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;
  const estimate = validYield && pricePerQuintal && area > 0 ? rupees(perAcre * 10 * pricePerQuintal) : null;
  return <View style={styles.stack}><Card><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>YIELD PLANNING</Text><Text style={[S.sectionTitle, { marginTop: 4 }]}>{profile.crop || 'Choose your crop'}</Text><Text style={S.muted}>{profile.area || 'Add farm area'} · {profile.village}</Text></View><View style={styles.yieldIcon}><Icon name="sprout" size={23} color={C.green} /></View></View>
    <View style={[styles.yieldBanner, { marginTop: 15 }]}><View style={{ flex: 1 }}><Text style={{ color: '#e0f0df', fontSize: 12, fontWeight: '700' }}>PLANNING RANGE · WHOLE FARM</Text><Text style={{ color: C.white, fontSize: 29, fontWeight: '900', marginTop: 5 }}>{validYield && area > 0 ? `${totalLow.toFixed(1)}–${totalHigh.toFixed(1)}` : 'Add farm details'}</Text><Text style={{ color: C.white, fontSize: 13 }}>tonnes {validYield && area > 0 ? `across ${area.toFixed(1)} acres` : ''}</Text></View><Icon name="chart-areaspline" size={39} color="#d8ead5" /></View>
    <View style={styles.yieldInputBlock}><Text style={styles.inputLabel}>Planning yield per acre (tonnes)</Text><View style={styles.field}><TextInput value={yieldPerAcre} onChangeText={value => setYieldPerAcre(value.replace(/[^\d.]/g, ''))} placeholder="Enter your expected yield" keyboardType="decimal-pad" style={styles.profileInput} /></View><Text style={[S.muted, { marginTop: 5 }]}>Adjust this starting reference to match your crop, season, and past harvests.</Text></View>
    <View style={[styles.yieldResults, { marginTop: 15 }]}><View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>PLANNING REVENUE / ACRE</Text><Text style={[styles.itemTitle, { fontSize: 20, marginTop: 5 }]}>{estimate ?? 'Price not available'}</Text><Text style={S.muted}>{estimate ? `Using current mandi modal price · ₹${pricePerQuintal?.toLocaleString('en-IN')} / quintal` : market.loading ? 'Checking current mandi price…' : 'Revenue appears when a current mandi price is available.'}</Text></View><Icon name="currency-inr" size={23} color={C.green} /></View>
    </Card>
    <Card><View style={styles.rowBetween}><Text style={S.sectionTitle}>Satellite crop signal</Text><Pressable onPress={() => void satellite.refresh()}><Text style={styles.link}>{satellite.loading ? 'Analyzing…' : 'Refresh'}</Text></Pressable></View>{satellite.data?.latest ? <View style={styles.satelliteScore}><View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>NDVI VIGOR INDEX</Text><Text style={[styles.itemTitle, { fontSize: 19, marginTop: 3 }]}>{satellite.data.latest.vigorScore} / 100</Text><Text style={S.muted}>NDVI {satellite.data.latest.ndvi.toFixed(2)} · {new Date(satellite.data.latest.date).toLocaleDateString()}</Text></View><Tag>{satellite.data.latest.changeFromPrevious === null ? 'FIRST PASS' : satellite.data.latest.changeFromPrevious >= 0 ? 'TREND UP' : 'TREND DOWN'}</Tag></View> : <Text style={[S.muted, { marginTop: 7 }]}>{satellite.error || (satellite.loading ? 'Checking recent Sentinel-2 observations…' : 'Add a precise map pin to check recent satellite observations.')}</Text>}<Text style={[S.muted, { marginTop: 8 }]}>Vegetation index from Sentinel-2 L2A via public Earth Search, measured over the estimated field boundary. It reflects canopy greenness and is not a disease diagnosis.</Text></Card>
    <Card><Text style={S.sectionTitle}>How this estimate is worked out</Text><Text style={[S.muted, { marginTop: 6 }]}>The range is 90–110% of your entered yield assumption, multiplied by the farm area in your profile. Revenue uses the current paddy modal price when available. This is a planning calculation, not an AI forecast.</Text><View style={styles.readinessRow}><Icon name="information-outline" size={18} color={C.gold} /><Text style={[S.muted, { flex: 1 }]}>A field boundary, sowing date, soil and irrigation details, and local harvest records are needed before we can produce a farm-specific yield forecast.</Text></View></Card>
    <Card><Text style={S.sectionTitle}>Data needed for a farm forecast</Text><View style={styles.yieldNeed}><Icon name="check-circle-outline" color={profile.crop ? C.green : C.gold} /><Text style={S.body}>Crop and farm area {profile.crop && area > 0 ? '· in your profile' : '· update your profile'}</Text></View><View style={styles.yieldNeed}><Icon name="calendar-month-outline" color={C.gold} /><Text style={S.body}>Sowing date and crop growth stage</Text></View><View style={styles.yieldNeed}><Icon name="map-outline" color={C.gold} /><Text style={S.body}>Draw the field boundary on the map</Text></View><View style={styles.yieldNeed}><Icon name="satellite-variant" color={C.gold} /><Text style={S.body}>Satellite growth history and local harvest records</Text></View></Card>
    <Button title="Open satellite farm map" icon="map-outline" onPress={() => go('map')} /></View>;
}

function MarketScreen({ go }: { go: (s: string) => void }) {
  const { profile } = useFarmProfile();
  const { data, loading, error, refresh } = useLiveMarketPrices(profile.state);
  const sampleMode = !data;
  const prices = data?.prices ?? marketPrices.map(item => ({ market: item.market, district: '', commodity: 'Paddy', variety: '', arrivalDate: 'Sample data', minPrice: item.price - 50, maxPrice: item.price + 50, modalPrice: item.price }));
  const best = [...prices].sort((a, b) => b.modalPrice - a.modalPrice)[0];
  return <View style={styles.stack}><Card><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={S.sectionTitle}>Nearby markets</Text><Text style={S.muted}>Paddy · ₹ per quintal · {sampleMode ? 'sample prices' : 'AGMARKNET / data.gov.in'}</Text></View><Pressable onPress={() => void refresh()}><Text style={styles.link}>Refresh</Text></Pressable></View><View style={{ marginTop: 10 }}>{loading && !data ? <Text style={[S.muted, { marginVertical: 8 }]}>Checking current mandi prices…</Text> : null}{error ? <View style={{ backgroundColor: '#fff7e5', padding: 11, borderRadius: 12, marginVertical: 8 }}><Text style={{ color: C.ink, fontSize: 12 }}>{error} {sampleMode ? 'Showing sample prices until the data service is configured.' : ''}</Text></View> : null}{prices.length ? prices.map((item, i) => <View key={`${item.market}-${item.arrivalDate}`} style={styles.marketRow}><View style={styles.marketIcon}><Icon name="storefront-outline" size={18} color={C.green} /></View><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.market}</Text><Text style={S.muted}>{item.district || (i === 0 ? 'Best price in sample' : 'Sample mandi')} · {item.arrivalDate || 'Date unavailable'}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.marketPrice}>₹{item.modalPrice.toLocaleString('en-IN')}</Text><Text style={S.muted}>₹{item.minPrice.toLocaleString('en-IN')}–₹{item.maxPrice.toLocaleString('en-IN')}</Text></View></View>) : <Text style={S.muted}>No paddy listings were returned for this state.</Text>}</View></Card>
    <Card><Text style={S.sectionTitle}>Market guidance</Text><View style={styles.recommendation}><Icon name="lightbulb-on-outline" color={C.green} /><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{best ? `${best.market} · ₹${best.modalPrice.toLocaleString('en-IN')} / quintal` : 'No current price available'}</Text><Text style={S.muted}>{sampleMode ? 'Illustrative price only. Compare local transport and quality deductions before deciding where to sell.' : `Highest modal price in the returned listings. Compare transport costs and grain quality before choosing a mandi. ${best?.variety ? `Variety: ${best.variety}.` : ''}`}</Text></View></View><Text style={[S.muted, { marginTop: 13 }]}>Live mandi listings show daily minimum, maximum and modal wholesale prices. They do not include transport, fees or a guaranteed sale price.</Text></Card><Button title="Ask AI about selling" icon="robot-outline" onPress={() => go('assistant')} /></View>;
}

function Schemes() {
  const [tab, setTab] = useState('For your farm');
  const [expanded, setExpanded] = useState('');
  const { data, loading, error, refresh } = useGovernmentSchemes();
  const allSchemes = data?.schemes ?? [];
  const relevantSchemes = allSchemes.filter(scheme => scheme.relevant);
  const visibleSchemes = tab === 'For your farm' ? relevantSchemes : allSchemes;
  const openOfficial = async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      await Linking.openURL(url);
    }
    catch { Alert.alert('Unable to open link', 'Please try again or visit the official website shown on this card.'); }
  };
  return <View style={styles.stack}><View style={styles.rowBetween}><View style={styles.segment}>{['For your farm', 'All schemes'].map(label => <Pressable key={label} onPress={() => setTab(label)} style={[styles.segmentItem, tab === label && styles.segmentActive]}><Text style={[styles.segmentText, tab === label && { color: C.greenDark }]}>{label === 'For your farm' && data ? `For your farm (${relevantSchemes.length})` : label === 'All schemes' && data ? `All schemes (${allSchemes.length})` : label}</Text></Pressable>)}</View><Pressable onPress={() => void refresh()}><Text style={styles.link}>Refresh</Text></Pressable></View>
    {loading && !data ? <Card><Text style={S.muted}>Loading official scheme information…</Text></Card> : null}
    {error ? <Card style={{ backgroundColor: '#fff7e5' }}><Text style={styles.itemTitle}>Could not refresh scheme information</Text><Text style={[S.muted, { marginTop: 5 }]}>{error}</Text></Card> : null}
    {visibleSchemes.map(scheme => <Card key={scheme.id}><View style={styles.rowBetween}><View style={styles.schemeIcon}><Text style={{ fontSize: 24 }}>{scheme.category === 'Crop insurance' ? '🌱' : scheme.category === 'Soil testing' ? '🧪' : '🌾'}</Text></View><View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.itemTitle}>{scheme.name}</Text><Text style={S.muted}>{scheme.category}</Text></View><Tag>{scheme.relevant ? 'RELEVANT' : 'CHECK DETAILS'}</Tag></View><Text style={[S.body, { marginTop: 12 }]}>{scheme.summary}</Text><Text style={{ color: C.greenDark, fontSize: 14, fontWeight: '800', marginTop: 10 }}>{scheme.benefit}</Text><View style={{ marginTop: 11, backgroundColor: '#f7f9f4', padding: 12, borderRadius: 12 }}><Text style={styles.itemTitle}>Eligibility guidance</Text><Text style={[S.muted, { marginTop: 5 }]}>{scheme.eligibility}</Text></View>
      {expanded === scheme.id ? <View style={{ marginTop: 12 }}><Text style={styles.itemTitle}>Documents or details to prepare</Text>{scheme.documents.map(document => <Text key={document} style={[S.muted, { marginTop: 5 }]}>• {document}</Text>)}<Pressable onPress={() => void openOfficial(scheme.sourceUrl)} style={{ marginTop: 12 }}><Text style={styles.link}>Source: official government information ↗</Text></Pressable><Text style={[S.muted, { marginTop: 5 }]}>Reviewed {scheme.reviewedAt}</Text></View> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 13, flexWrap: 'wrap' }}><Button title="Check official details" icon="open-in-new" onPress={() => void openOfficial(scheme.applicationUrl)} style={{ flexGrow: 1 }} /><Button title={expanded === scheme.id ? 'Hide details' : 'More details'} secondary icon="text-box-outline" onPress={() => setExpanded(expanded === scheme.id ? '' : scheme.id)} style={{ flexGrow: 1 }} /></View>
    </Card>)}
    {!loading && data && visibleSchemes.length === 0 ? <Card><Text style={styles.itemTitle}>No matches for this farm yet</Text><Text style={[S.muted, { marginTop: 5 }]}>Browse all schemes or ask your local Agriculture Department about current programmes.</Text></Card> : null}
    <Card style={{ backgroundColor: '#f1f6ee' }}><Text style={styles.itemTitle}>Please confirm before applying</Text><Text style={[S.muted, { marginTop: 5 }]}>These recommendations use the farm’s state and crop. They do not confirm eligibility or beneficiary status. Rules, notified crops, and application dates can change; the relevant government department makes the final decision.</Text><Text style={[S.muted, { marginTop: 7 }]}>Catalogue last reviewed {data?.updatedAt ?? 'not available'}.</Text></Card></View>;
}

function Notifications({ filter, setFilter }: { filter: string; setFilter: (s: string) => void }) {
  const all = [
    { type: 'Alerts', icon: 'weather-pouring', color: C.blue, title: 'Rain likely tomorrow', body: 'Avoid pesticide spraying.', time: 'Today · 8:00 AM' },
    { type: 'Schemes', icon: 'bank', color: C.orange, title: 'PM-KISAN deadline', body: 'Enrollment closes in 5 days.', time: 'Today · 7:30 AM' },
    { type: 'Alerts', icon: 'alert-outline', color: C.red, title: 'Disease risk increased', body: 'Higher probability of leaf spot nearby.', time: 'Yesterday · 6:45 PM' },
    { type: 'Alerts', icon: 'chart-line', color: C.green, title: 'Market price up', body: 'Rice price increased by 3%.', time: 'Yesterday · 5:20 PM' },
    { type: 'Tasks', icon: 'clipboard-text-outline', color: C.orange, title: 'Task reminder', body: 'Irrigate South Field.', time: 'Yesterday · 8:00 AM' },
  ];
  const options = ['All', 'Alerts', 'Tasks', 'Schemes'];
  const shown = filter === 'All' ? all : all.filter(a => a.type === filter);
  return <Card><View style={styles.segment}>{options.map(t => <Pressable key={t} onPress={() => setFilter(t)} style={[styles.segmentItem, filter === t && styles.segmentActive]}><Text style={[styles.segmentText, filter === t && { color: C.greenDark }]}>{t}</Text></Pressable>)}</View><View style={{ marginTop: 9 }}>{shown.map(item => <View key={item.title} style={styles.notificationRow}><View style={[styles.notificationIcon, { backgroundColor: `${item.color}18` }]}><Icon name={item.icon} size={20} color={item.color} /></View><View style={{ flex: 1 }}><View style={styles.rowBetween}><Text style={styles.itemTitle}>{item.title}</Text><Text style={S.muted}>{item.time}</Text></View><Text style={S.muted}>{item.body}</Text></View></View>)}</View></Card>;
}

function Community() {
  const { profile } = useFarmProfile();
  const [tab, setTab] = useState('Discussions');
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState(discussions);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [requestedExperts, setRequestedExperts] = useState<Record<string, boolean>>({});
  const initials = getInitials(profile.name);
  return <View style={styles.stack}><Card>
    <View style={styles.rowBetween}><View style={styles.segment}>{['Discussions', 'Experts'].map(t => <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && styles.segmentActive]}><Text style={[styles.segmentText, tab === t && { color: C.greenDark }]}>{t}</Text></Pressable>)}</View><Tag>{tab.toUpperCase()}</Tag></View>
    {tab === 'Discussions' ? <>
      <View style={styles.askRow}><TextInput value={draft} onChangeText={setDraft} placeholder="Ask your farming community..." style={styles.askInput} /><Pressable accessibilityLabel="Post question" onPress={() => { if (draft.trim()) { setPosts([{ id: `post-${Date.now()}`, name: profile.name, time: 'Just now', title: draft.trim(), body: 'Your question has been shared with the farming community.', likes: 0, replies: [], initials }, ...posts]); setDraft(''); } }} style={styles.sendButton}><Icon name="send" color={C.white} size={18} /></Pressable></View>
      {posts.map(post => {
        const isExpanded = Boolean(expandedPosts[post.id]);
        const isLiked = Boolean(likedPosts[post.id]);
        return <View key={post.id} style={styles.discussion}><View style={styles.discussionAvatar}><Text style={{ color: C.greenDark, fontWeight: '800' }}>{post.initials}</Text></View><View style={{ flex: 1 }}>
          <View style={styles.rowBetween}><Text style={styles.itemTitle}>{post.title}</Text><Text style={S.muted}>{post.time}</Text></View>
          <Text style={S.muted}>{post.name} · Farmer</Text><Text style={[S.body, { marginTop: 5 }]}>{post.body}</Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} ${post.replies.length} replies`} onPress={() => setExpandedPosts(current => ({ ...current, [post.id]: !current[post.id] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="comment-outline" size={15} color={C.green} /><Text style={styles.link}>{post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}{isExpanded ? ' · Hide' : ''}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={isLiked ? 'Unlike post' : 'Like post'} onPress={() => setLikedPosts(current => ({ ...current, [post.id]: !current[post.id] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name={isLiked ? 'heart' : 'heart-outline'} size={15} color={isLiked ? C.red : C.green} /><Text style={[styles.link, isLiked && { color: C.red }]}>{isLiked ? 'Liked' : 'Like'}{post.likes + (isLiked ? 1 : 0) ? ` · ${post.likes + (isLiked ? 1 : 0)}` : ''}</Text></Pressable>
          </View>
          {isExpanded ? <View style={{ marginTop: 10, marginLeft: 3, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.greenSoft }}>
            {post.replies.length ? post.replies.map((reply, index) => <View key={`${post.id}-reply-${index}`} style={{ marginBottom: 9 }}><Text style={[styles.itemTitle, { fontSize: 13 }]}>{reply.name}</Text><Text style={[S.body, { fontSize: 13, marginTop: 2 }]}>{reply.body}</Text></View>) : <Text style={S.muted}>No replies yet. Be the first to reply.</Text>}
            <View style={[styles.askRow, { marginTop: 4, marginBottom: 0 }]}><TextInput value={replyDrafts[post.id] || ''} onChangeText={value => setReplyDrafts(current => ({ ...current, [post.id]: value }))} placeholder="Write a reply..." style={styles.askInput} /><Pressable accessibilityLabel="Send reply" onPress={() => { const reply = replyDrafts[post.id]?.trim(); if (reply) { setPosts(current => current.map(item => item.id === post.id ? { ...item, replies: [...item.replies, { name: profile.name, body: reply }] } : item)); setReplyDrafts(current => ({ ...current, [post.id]: '' })); } }} style={[styles.sendButton, { width: 38, height: 38 }]}><Icon name="send" color={C.white} size={15} /></Pressable></View>
          </View> : null}
        </View></View>;
      })}
    </> : <View style={{ marginTop: 7 }}>
      <Text style={[S.muted, { marginBottom: 6 }]}>Farm specialists you can connect with</Text>
      {communityExperts.map(expert => <View key={expert.id} style={[styles.discussion, { alignItems: 'center' }]}>
        <View style={[styles.discussionAvatar, { width: 46, height: 46, borderRadius: 24 }]}><Text style={{ color: C.greenDark, fontWeight: '800' }}>{expert.initials}</Text></View>
        <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}><Text style={styles.itemTitle}>{expert.name}</Text><Text style={{ color: '#b77912', fontSize: 13, fontWeight: '800' }}>★ {expert.rating}</Text></View><Text style={S.muted}>{expert.specialty}</Text><Text style={[S.muted, { fontSize: 12 }]}>{expert.location} · {expert.reviews} farmer reviews</Text></View>
        <Button title={requestedExperts[expert.id] ? 'Requested' : 'Connect'} secondary={!requestedExperts[expert.id]} onPress={() => setRequestedExperts(current => ({ ...current, [expert.id]: !current[expert.id] }))} />
      </View>)}
    </View>}
  </Card></View>;
}

function Profile({ go }: { go: (s: string) => void }) {
  const { profile } = useFarmProfile();
  const { language } = useLanguage();
  const selectedLanguage = languageOptions.find(option => option.id === language)?.nativeName ?? 'English';
  const rows = [
    ['Farm details', 'Manage your land and farm info', 'clipboard-text-outline', 'profile-setup?returnTo=profile'],
    ['Manage crops', 'Paddy (Rice) · 10 acres', 'sprout', 'yield'], ['Farm locations', 'Anakapalle, Andhra Pradesh', 'map-marker-outline', 'map'],
    ['Notification preferences', 'Alerts, tasks and schemes', 'bell-outline', 'notifications'], ['Language', selectedLanguage, 'translate', 'dashboard'],
    ['Help & support', 'Get help using Kisaan Mitra', 'help-circle-outline', 'assistant'], ['About Kisaan Mitra AI', 'A farming companion for every season', 'information-outline', 'closing'],
  ];
  return <View style={styles.stack}><Card><View style={styles.profileHeader}><Image source={farmerAvatar} resizeMode="cover" style={styles.profilePhoto} /><View style={{ flex: 1 }}><Text style={S.sectionTitle}>{profile.name}</Text><Text style={S.muted}>Farmer · {profile.area}</Text><Text style={S.muted}>{profile.village}, {profile.state}</Text><Text style={S.muted}>{profile.location}</Text></View><Tag>VERIFIED</Tag></View><Divider />{rows.map(([label, detail, icon, route]) => <Pressable key={label} onPress={() => go(route)} style={styles.profileRow}><Icon name={icon} size={20} color={C.green} /><View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.itemTitle}>{label}</Text><Text style={S.muted}>{label === 'Farm details' ? `${profile.district} · ${profile.crop} · ${profile.area}` : detail}</Text></View><Icon name="chevron-right" color={C.muted} /></Pressable>)}</Card><Button title="Log out" secondary icon="logout" onPress={() => go('login')} /></View>;
}

function More({ go }: { go: (s: string) => void }) {
  return <View style={styles.shortcutGrid}>{menu.filter(([id]) => id !== 'dashboard').map(([id, label, icon]) => <Pressable key={id} onPress={() => go(id)} style={styles.shortcut}><View style={styles.shortcutIcon}><Icon name={icon} size={22} color={C.green} /></View><Text style={styles.itemTitle}>{label}</Text><Icon name="arrow-top-right" size={16} color={C.muted} /></Pressable>)}</View>;
}

function Closing({ go }: { go: (s: string) => void }) {
  return <View style={styles.closing}><ImageBackground source={farmerHero} resizeMode="cover" style={styles.closingPhoto} imageStyle={{ borderRadius: 20 }}><View style={styles.closingPhotoCaption}><Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>For farmers. For a brighter tomorrow.</Text></View></ImageBackground><Text style={styles.closingTitle}>Together for a{ '\n' }better tomorrow</Text><Text style={[S.subtitle, { textAlign: 'center', maxWidth: 350, marginTop: 12 }]}>Empowering farmers with the power of AI.</Text><Button title="Keep growing with Kisaan Mitra AI" icon="arrow-right" onPress={() => go('dashboard')} style={{ width: '100%', maxWidth: 390, marginTop: 26 }} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.cream }, main: { flex: 1, minWidth: 0 },
  profileInput: { flex: 1, minHeight: 36, paddingVertical: 5, color: C.ink, fontSize: 13, outlineStyle: 'none' as any },
  formError: { color: C.red, backgroundColor: C.redSoft, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, lineHeight: 17 },
  selectField: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, borderWidth: 1, borderColor: C.border, backgroundColor: '#fbfcf9', paddingHorizontal: 11 },
  selectPopup: { width: '100%', maxWidth: 500, alignSelf: 'center', backgroundColor: C.white, borderRadius: 22, padding: 20, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  selectSearch: { minHeight: 45, marginVertical: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, color: C.ink, outlineStyle: 'none' as any },
  selectOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#edf0ea' }, selectCustom: { backgroundColor: C.greenSoft, borderRadius: 11, marginTop: 6 },
  mapPickerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0007', padding: 12 },
  mapPickerPopup: { width: '100%', maxWidth: 760, maxHeight: '95%', backgroundColor: C.white, borderRadius: 22, padding: 16, gap: 13, elevation: 14 },
  languageButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#cfe2d1', borderRadius: 12, backgroundColor: C.white, paddingHorizontal: 13 },
  languageBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006', padding: 12 },
  languagePopup: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: C.white, borderRadius: 22, padding: 20, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  languageOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#edf0ea' }, languageOptionSelected: { backgroundColor: C.greenSoft, borderRadius: 11 },
  sidebar: { width: 250, height: '100%', flexShrink: 0, backgroundColor: '#173b2b', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20 }, sidebarMenu: { flex: 1, minHeight: 0 }, sidebarMenuContent: { paddingBottom: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 34, paddingHorizontal: 4 }, brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' }, brandName: { color: C.white, fontSize: 17, fontWeight: '900' }, brandSub: { color: '#a8c4ac', fontSize: 9, letterSpacing: 1.2, marginTop: 2 }, sideLabel: { color: '#87a48d', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginHorizontal: 10, marginBottom: 9 },
  sideLink: { minHeight: 43, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 11, marginBottom: 4 }, sideLinkActive: { backgroundColor: '#2b6844' }, sideLinkText: { color: '#d5e0d5', fontSize: 13, flex: 1 }, sideBadge: { backgroundColor: '#b75b45', width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, sidebarBottom: { marginTop: 'auto', padding: 13, backgroundColor: '#204b35', borderRadius: 14 },
  topbar: { height: 65, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 12 }, crumb: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, brandMarkSmall: { width: 33, height: 33, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, brandMobile: { color: C.ink, fontSize: 16, fontWeight: '900' }, bell: { width: 38, height: 38, backgroundColor: '#f5f7f2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, bellDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, backgroundColor: C.red, borderRadius: 5 }, avatar: { width: 35, height: 35, borderRadius: 20, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }, desktopContent: { paddingTop: 27 }, onboardContent: { flexGrow: 1, justifyContent: 'center', maxWidth: 940 }, pageHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 21, gap: 12 }, screenBody: { gap: 16 }, disclaimer: { color: '#8a9388', fontSize: 10, textAlign: 'center', marginTop: 24, paddingHorizontal: 10 },
  stack: { gap: 15 }, rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, cardEyebrow: { color: C.muted, fontSize: 11, fontWeight: '700' }, link: { color: C.green, fontWeight: '800', fontSize: 12 },
  welcomeCard: { backgroundColor: C.greenDark, borderColor: C.greenDark, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, weatherCard: { minWidth: 270 }, tempRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 13 }, temp: { color: C.ink, fontSize: 37, fontWeight: '900' }, healthLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 }, healthScore: { fontSize: 37, fontWeight: '900', color: C.green }, taskPreview: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 15 }, taskBullet: { width: 10, height: 10, backgroundColor: C.gold, borderRadius: 7 }, itemTitle: { color: C.ink, fontSize: 13, fontWeight: '800' }, schemeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }, schemeMini: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 220, backgroundColor: '#f8faf6', borderRadius: 13, padding: 11 },
  bottomNav: { minHeight: 64, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 3 }, bottomItem: { minWidth: 54, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3 }, bottomText: { fontSize: 10, color: C.muted },
  splash: { alignItems: 'center', justifyContent: 'center', paddingVertical: 25 }, splashLogo: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }, splashBrand: { color: C.ink, fontSize: 28, fontWeight: '900', marginTop: 14 }, splashTagline: { color: C.muted, fontSize: 15, marginTop: 5 }, heroPhoto: { height: 310, width: '100%', maxWidth: 470, marginTop: 22, borderRadius: 24, justifyContent: 'flex-end', overflow: 'hidden' }, heroPhotoCaption: { backgroundColor: 'rgba(19, 57, 38, 0.82)', paddingHorizontal: 17, paddingVertical: 14, margin: 10, borderRadius: 15 }, heroCaptionTitle: { color: C.white, fontSize: 17, fontWeight: '900' }, heroCaptionBody: { color: '#e0eddf', fontSize: 12, marginTop: 4 }, farmerHeroPortrait: { width: 78, height: 112, borderRadius: 15, borderWidth: 1, borderColor: '#ffffff70' }, splashPerks: { width: '100%', maxWidth: 360, flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 }, perk: { color: C.greenDark, fontWeight: '700', fontSize: 11 }, onboardWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 }, onboardIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, inputLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }, phoneInput: { height: 47, borderColor: C.border, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 }, input: { flex: 1, outlineStyle: 'none' as any }, field: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: C.border, backgroundColor: '#fbfcf9', justifyContent: 'center', paddingHorizontal: 11 }, locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f6faf4', padding: 11 },
  otpBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006', padding: 12 }, otpPopup: { width: '100%', maxWidth: 500, alignSelf: 'center', backgroundColor: C.white, borderRadius: 22, padding: 20, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12 }, verificationMessage: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f0f6ed', padding: 13, borderRadius: 13, marginVertical: 15 }, verificationMessageText: { color: C.ink, fontSize: 13, flex: 1 }, otpInput: { height: 49, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '800', color: C.ink }, authError: { color: C.red, fontSize: 12, marginTop: 7 },
  segment: { flexDirection: 'row', backgroundColor: '#f0f3ed', padding: 3, borderRadius: 11, alignSelf: 'flex-start' }, segmentItem: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 }, segmentActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, segmentText: { color: C.muted, fontSize: 12, fontWeight: '700' }, priorityHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }, taskRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#edf0ea' },
  leafPhoto: { width: '100%', height: 220, borderRadius: 16 }, adviceBox: { backgroundColor: '#f5f8f2', padding: 13, borderRadius: 13, marginTop: 12 },
  weatherHero: { backgroundColor: '#397c9a', borderColor: '#397c9a' }, weatherInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, borderRadius: 12, backgroundColor: '#ffffff20', flex: 1, minWidth: 145 }, forecastRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf0ea', gap: 9 }, alertRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 15 }, alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mapLocationLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  satelliteNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fff8e9', borderRadius: 12, padding: 11, marginTop: 12 },
  satelliteScore: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#f3f8ef', borderRadius: 13, padding: 12, marginTop: 12 },
  ndviChart: { height: 125, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 5, marginTop: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  ndviColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  ndviValue: { color: C.muted, fontSize: 9 }, ndviBar: { width: '60%', minHeight: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#75a95d' }, ndviDate: { color: C.muted, fontSize: 8, height: 15 },
  yieldBanner: { backgroundColor: C.green, borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, yieldIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }, yieldInputBlock: { marginTop: 15 }, yieldResults: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, backgroundColor: '#f5f8f2', padding: 12 }, readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 13, backgroundColor: '#fff8e9', padding: 11, borderRadius: 12 }, yieldNeed: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  marketRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#edf0ea' }, marketIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }, marketPrice: { fontSize: 15, fontWeight: '900', color: C.ink }, recommendation: { flexDirection: 'row', gap: 9, marginTop: 12, backgroundColor: '#f1f6ee', padding: 12, borderRadius: 13 }, pricePolyline: { flex: 1, position: 'absolute', top: 0, bottom: 24, left: 54, right: 0, borderBottomWidth: 1, borderBottomColor: '#e6ede2' }, pricePoint: { position: 'absolute', width: 8, height: 8, backgroundColor: C.green, borderRadius: 5, borderWidth: 2, borderColor: C.white },
  assistantCard: { minHeight: 500 }, assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, assistantAvatar: { width: 41, height: 41, borderRadius: 14, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' }, chatBubble: { padding: 12, borderRadius: 15, maxWidth: '88%' }, chatFarmer: { backgroundColor: C.green, alignSelf: 'flex-end', borderBottomRightRadius: 4 }, chatAI: { backgroundColor: '#f1f4ee', alignSelf: 'flex-start', borderBottomLeftRadius: 4 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 }, questionChip: { borderRadius: 18, borderWidth: 1, borderColor: '#dce8d8', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#f7faf5' }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 }, composerInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#fbfcf9', outlineStyle: 'none' as any }, sendButton: { width: 43, height: 43, backgroundColor: C.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, voiceButton: { alignSelf: 'center', width: 58, height: 58, borderRadius: 30, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  schemeIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#f4f7ee', alignItems: 'center', justifyContent: 'center' }, notificationRow: { flexDirection: 'row', gap: 11, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#edf0ea' }, notificationIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  askRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 }, askInput: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, outlineStyle: 'none' as any }, discussion: { flexDirection: 'row', gap: 10, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#edf0ea' }, discussionAvatar: { width: 36, height: 36, backgroundColor: C.greenSoft, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, profilePhoto: { width: 62, height: 62, borderRadius: 22 }, profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#edf0ea' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, shortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 72, flexGrow: 1, flexBasis: 220, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border }, shortcutIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }, closing: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 580, backgroundColor: '#f5ecd6', borderRadius: 25, padding: 25 }, closingPhoto: { width: '100%', maxWidth: 500, height: 260, borderRadius: 20, justifyContent: 'flex-end', overflow: 'hidden' }, closingPhotoCaption: { backgroundColor: 'rgba(19, 57, 38, 0.78)', padding: 14, margin: 10, borderRadius: 14 }, closingTitle: { color: C.greenDark, fontSize: 31, fontWeight: '900', textAlign: 'center', marginTop: 23, letterSpacing: -0.5 },
});
