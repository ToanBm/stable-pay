import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from './utils/constants';
import OnRampPage from './pages/OnRampPage';
import OffRampPage from './pages/OffRampPage';
import HomePage from './pages/HomePage';
import AccountPage from './pages/AccountPage';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Minimalist Nav Link
const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`text-sm font-medium transition-colors ${
        isActive 
          ? 'text-white border-b-2 border-brand-primary pb-0.5' 
              : 'text-white hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  return (
    <nav className="h-14 border-b border-white/10 bg-brand-dark/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-sm bg-brand-primary flex items-center justify-center">
              <span className="text-white text-xl font-bold">S</span>
            </div>
            <span className="text-2xl font-semibold text-white tracking-tight">StablePay</span>
          </Link>
          <div className="h-4 w-px bg-brand-light/10"></div>
          <div className="flex gap-6">
            <NavLink to="/on-ramp">Buy</NavLink>
            <NavLink to="/off-ramp">Cashout</NavLink>
            <NavLink to="/account">Account</NavLink>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
          <span className="text-xs text-white font-mono">Stable Testnet</span>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Elements stripe={stripePromise} options={{ locale: 'en' }}>
      <BrowserRouter>
        <div className="min-h-screen bg-brand-dark text-brand-light font-sans selection:bg-brand-primary selection:text-white">
          <Navbar />
          
          <main className="max-w-5xl mx-auto px-6 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/on-ramp" element={<OnRampPage />} />
              <Route path="/off-ramp" element={<OffRampPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Elements>
  );
}

export default App;
