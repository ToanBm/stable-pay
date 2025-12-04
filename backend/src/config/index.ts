import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
// Note: STABLE_RPC_URL and USDT_CONTRACT_ADDRESS have defaults, so not required
const requiredEnvVars = [
  'EMPLOYER_PRIVATE_KEY',
  'OFFRAMP_PRIVATE_KEY',
  'STRIPE_SECRET_KEY',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(
    `Warning: Missing environment variables: ${missingEnvVars.join(', ')}`
  );
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  blockchain: {
    rpcUrl: process.env.STABLE_RPC_URL || 'https://rpc.testnet.stable.xyz',
    usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000001000',
    employerPrivateKey: process.env.EMPLOYER_PRIVATE_KEY || '',
    offrampPrivateKey: process.env.OFFRAMP_PRIVATE_KEY || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  },
};

