import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './services/auth';
import BottomNav from './components/BottomNav';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import SessionScreen from './screens/SessionScreen';
import GalleryScreen from './screens/GalleryScreen';
import FamilyScreen from './screens/FamilyScreen';
import ProfileScreen from './screens/ProfileScreen';

function Protected({ children, nav: showNav = true }) {
  if (!isAuthenticated()) return <Navigate to="/app/login" />;
  return <>{children}{showNav && <BottomNav />}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app/login" element={<LoginScreen />} />
        <Route path="/app/register" element={<RegisterScreen />} />
        <Route path="/app/onboarding" element={<OnboardingScreen />} />
        <Route path="/app" element={<Protected><HomeScreen /></Protected>} />
        <Route path="/app/" element={<Protected><HomeScreen /></Protected>} />
        <Route path="/app/session" element={<Protected nav={false}><SessionScreen /></Protected>} />
        <Route path="/app/gallery" element={<Protected><GalleryScreen /></Protected>} />
        <Route path="/app/family" element={<Protected><FamilyScreen /></Protected>} />
        <Route path="/app/profile" element={<Protected><ProfileScreen /></Protected>} />
        <Route path="*" element={<Navigate to="/app/" />} />
      </Routes>
    </BrowserRouter>
  );
}
