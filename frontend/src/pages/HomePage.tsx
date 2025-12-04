import React from 'react';
import { Link } from 'react-router-dom';

const ActionCard = ({ 
  title, 
  description, 
  icon, 
  link, 
  actionText 
}: { 
  title: string; 
  description: string; 
  icon: string; 
  link: string; 
  actionText: string; 
}) => (
  <Link to={link} className="block group">
    <div className="h-full bg-white/5 border border-white/10 rounded-lg p-6 transition-all hover:border-brand-primary/50 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(0,123,80,0.1)]">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded bg-brand-primary/10 flex items-center justify-center text-lg border border-brand-primary/20 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
          {icon}
        </div>
        <span className="text-xs text-white group-hover:text-white transition-colors font-medium">
          {actionText} →
        </span>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white leading-relaxed">{description}</p>
    </div>
  </Link>
);

const FeatureItem = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-xs text-white">
    <div className="w-1.5 h-1.5 bg-brand-primary rounded-full"></div>
    {label}
  </div>
);

const HomePage: React.FC = () => {
  return (
    <div>
      <div className="mb-8 border-b border-white/10 pb-6">
        <h1 className="text-base font-medium text-white mb-1">Overview</h1>
        <p className="text-sm text-white">Manage your stablecoin transactions securely on Stable Testnet.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ActionCard 
          title="Buy Stablecoins" 
          description="Purchase USDT instantly using VISA or Mastercard. All transactions settle directly on Stable Testnet with low fees and real-time confirmation."
          icon="💳"
          link="/on-ramp"
          actionText="Start Purchase"
        />
        <ActionCard 
          title="Cashout to Bank" 
          description="Redeem your USDT balance for fiat and withdraw directly to your linked bank account. Supports multi-currency payouts with automated compliance checks."
          icon="🏦"
          link="/off-ramp"
          actionText="Request Cashout"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0C3223]/50 border border-white/5 rounded-lg p-5">
          <div className="mb-3 border-b border-white/5 pb-2">
            <h3 className="text-sm font-medium text-white">Buy Features</h3>
          </div>
          <div className="space-y-2">
            <FeatureItem label="Instant settlement on Stable Testnet" />
            <FeatureItem label="Low transaction fees" />
            <FeatureItem label="Supports USD, EUR" />
          </div>
        </div>
        
        <div className="bg-[#0C3223]/50 border border-white/5 rounded-lg p-5">
          <div className="mb-3 border-b border-white/5 pb-2">
            <h3 className="text-sm font-medium text-white">Cashout Capabilities</h3>
          </div>
          <div className="space-y-2">
            <FeatureItem label="Direct bank deposits (ACH/SEPA)" />
            <FeatureItem label="Automated compliance checks" />
            <FeatureItem label="Multi-currency support" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
