#!/usr/bin/env node

/**
 * Environment Validation and Fix Script
 * 
 * Validates and fixes:
 * - Environment variables loading
 * - Supabase RLS policies and database schema
 * - WebRTC STUN/TURN server configurations
 * - Browser permissions for media access
 * - Database indexes and performance optimizations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔧 Environment Validation and Fix Script\n');

// Track validation results
const validationResults = {
  environment: [],
  supabase: [],
  webrtc: [],
  database: [],
  browser: [],
  overall: true
};

function addResult(category, test, passed, details = '', fix = null) {
  const result = { test, passed, details, fix };
  validationResults[category].push(result);
  if (!passed) validationResults.overall = false;
  
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${test}${details ? ` - ${details}` : ''}`);
  if (!passed && fix) {
    console.log(`   💡 Fix: ${fix}`);
  }
}

// 1. Environment Variables Validation
console.log('🌍 Validating Environment Variables...');

function validateEnvironmentVariables() {
  // Check for .env files
  const envFile = path.join(projectRoot, '.env');
  const envLocalFile = path.join(projectRoot, '.env.local');
  
  if (!fs.existsSync(envFile) && !fs.existsSync(envLocalFile)) {
    addResult('environment', 'Environment files exist', false, 
      'No .env or .env.local found', 
      'Create .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    return;
  }
  
  // Read environment variables
  let envVars = {};
  
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) envVars[key.trim()] = value.trim();
    });
  }
  
  if (fs.existsSync(envLocalFile)) {
    const envLocalContent = fs.readFileSync(envLocalFile, 'utf8');
    envLocalContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) envVars[key.trim()] = value.trim();
    });
  }
  
  // Validate required variables
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !envVars[key]);
  
  if (missing.length > 0) {
    addResult('environment', 'Required environment variables', false,
      `Missing: ${missing.join(', ')}`,
      'Add missing variables to .env file');
  } else {
    addResult('environment', 'Required environment variables', true, 
      'All required variables present');
  }
  
  // Validate Supabase URL format
  if (envVars.VITE_SUPABASE_URL) {
    const urlPattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
    const isValidUrl = urlPattern.test(envVars.VITE_SUPABASE_URL);
    addResult('environment', 'Supabase URL format', isValidUrl,
      isValidUrl ? 'Valid Supabase URL' : 'Invalid URL format',
      'Ensure URL follows https://[project-id].supabase.co format');
  }
  
  // Validate JWT token format
  if (envVars.VITE_SUPABASE_ANON_KEY) {
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const isValidJwt = jwtPattern.test(envVars.VITE_SUPABASE_ANON_KEY);
    addResult('environment', 'Supabase anon key format', isValidJwt,
      isValidJwt ? 'Valid JWT format' : 'Invalid JWT format',
      'Check anon key from Supabase dashboard');
  }
  
  return envVars;
}

// 2. Supabase Configuration Validation
console.log('\n🗄️ Validating Supabase Configuration...');

function validateSupabaseConfig() {
  // Check Supabase client setup
  const supabaseClientPath = path.join(projectRoot, 'src/lib/supabase.ts');
  
  if (!fs.existsSync(supabaseClientPath)) {
    addResult('supabase', 'Supabase client setup', false,
      'supabase.ts not found',
      'Create src/lib/supabase.ts with proper client initialization');
    return;
  }
  
  const supabaseContent = fs.readFileSync(supabaseClientPath, 'utf8');
  
  // Check for proper imports
  const hasCreateClient = supabaseContent.includes('@supabase/supabase-js');
  addResult('supabase', 'Supabase imports', hasCreateClient,
    hasCreateClient ? 'Proper imports found' : 'Missing @supabase/supabase-js import',
    'npm install @supabase/supabase-js');
  
  // Check for environment variable usage
  const usesEnvVars = supabaseContent.includes('import.meta.env.VITE_SUPABASE_URL') &&
                     supabaseContent.includes('import.meta.env.VITE_SUPABASE_ANON_KEY');
  addResult('supabase', 'Environment variable usage', usesEnvVars,
    usesEnvVars ? 'Using environment variables' : 'Not using environment variables',
    'Use import.meta.env.VITE_SUPABASE_URL and import.meta.env.VITE_SUPABASE_ANON_KEY');
  
  // Check for createClient call
  const hasCreateClientCall = supabaseContent.includes('createClient');
  addResult('supabase', 'Client initialization', hasCreateClientCall,
    hasCreateClientCall ? 'Client properly initialized' : 'Missing createClient call',
    'Add createClient(supabaseUrl, supabaseAnonKey) call');
}

// 3. Database Schema Validation
console.log('\n📊 Validating Database Schema...');

function validateDatabaseSchema() {
  const migrationsDir = path.join(projectRoot, 'supabase/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    addResult('database', 'Migrations directory', false,
      'No migrations directory found',
      'Initialize Supabase project with supabase init');
    return;
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    addResult('database', 'Migration files', false,
      'No migration files found',
      'Create database migrations for required tables');
    return;
  }
  
  addResult('database', 'Migration files', true,
    `Found ${migrationFiles.length} migration files`);
  
  // Check for core tables in migrations
  const allMigrationContent = migrationFiles
    .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
    .join('\n');
  
  const requiredTables = [
    'rooms',
    'participants', 
    'webrtc_sessions',
    'webrtc_signals',
    'recording_sessions'
  ];
  
  requiredTables.forEach(table => {
    const hasTable = allMigrationContent.includes(`CREATE TABLE`) && 
                    allMigrationContent.includes(table);
    addResult('database', `${table} table`, hasTable,
      hasTable ? 'Table definition found' : 'Table missing',
      `Add CREATE TABLE ${table} to migrations`);
  });
  
  // Check for RLS policies
  const hasRLS = allMigrationContent.includes('ROW LEVEL SECURITY') &&
                allMigrationContent.includes('CREATE POLICY');
  addResult('database', 'RLS policies', hasRLS,
    hasRLS ? 'RLS policies found' : 'Missing RLS policies',
    'Add ROW LEVEL SECURITY and CREATE POLICY statements');
  
  // Check for performance indexes
  const hasIndexes = allMigrationContent.includes('CREATE INDEX');
  addResult('database', 'Performance indexes', hasIndexes,
    hasIndexes ? 'Indexes found' : 'Missing performance indexes',
    'Add CREATE INDEX statements for frequently queried columns');
}

// 4. WebRTC Configuration Validation
console.log('\n📡 Validating WebRTC Configuration...');

function validateWebRTCConfig() {
  // Check WebRTC implementation files
  const webrtcFiles = [
    'src/lib/realtimeWebRTC.ts',
    'src/components/WebRTCPanel.tsx',
    'src/services/webrtcService.ts'
  ];
  
  webrtcFiles.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    addResult('webrtc', `${path.basename(filePath)} exists`, exists,
      exists ? 'File found' : 'File missing',
      `Create ${filePath} with WebRTC implementation`);
  });
  
  // Check WebRTC service configuration
  const webrtcServicePath = path.join(projectRoot, 'src/lib/realtimeWebRTC.ts');
  if (fs.existsSync(webrtcServicePath)) {
    const webrtcContent = fs.readFileSync(webrtcServicePath, 'utf8');
    
    // Check for STUN/TURN server configuration
    const hasICEServers = webrtcContent.includes('iceServers') || 
                         webrtcContent.includes('stun:') ||
                         webrtcContent.includes('turn:');
    addResult('webrtc', 'ICE servers configuration', hasICEServers,
      hasICEServers ? 'ICE servers configured' : 'Missing ICE servers',
      'Add STUN/TURN servers to RTCConfiguration');
    
    // Check for proper error handling
    const hasErrorHandling = webrtcContent.includes('try') && 
                            webrtcContent.includes('catch');
    addResult('webrtc', 'Error handling', hasErrorHandling,
      hasErrorHandling ? 'Error handling found' : 'Missing error handling',
      'Add try/catch blocks for WebRTC operations');
    
    // Check for connection state monitoring
    const hasStateMonitoring = webrtcContent.includes('onconnectionstatechange') ||
                              webrtcContent.includes('connectionState');
    addResult('webrtc', 'Connection monitoring', hasStateMonitoring,
      hasStateMonitoring ? 'Connection monitoring found' : 'Missing connection monitoring',
      'Add connection state change handlers');
  }
}

// 5. Browser Permissions Validation
console.log('\n🔒 Validating Browser Permissions...');

function validateBrowserPermissions() {
  // Check for media access code
  const componentFiles = [
    'src/components/WebRTCPanel.tsx',
    'src/components/StreamlinedWebRTCPanel.tsx'
  ].filter(f => fs.existsSync(path.join(projectRoot, f)));
  
  if (componentFiles.length === 0) {
    addResult('browser', 'Media components', false,
      'No WebRTC components found',
      'Create WebRTC components for media access');
    return;
  }
  
  componentFiles.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for getUserMedia
    const hasGetUserMedia = content.includes('getUserMedia') ||
                           content.includes('navigator.mediaDevices');
    addResult('browser', `getUserMedia in ${path.basename(filePath)}`, hasGetUserMedia,
      hasGetUserMedia ? 'Media access code found' : 'Missing media access',
      'Add navigator.mediaDevices.getUserMedia() calls');
    
    // Check for getDisplayMedia (screen sharing)
    const hasGetDisplayMedia = content.includes('getDisplayMedia');
    addResult('browser', `getDisplayMedia in ${path.basename(filePath)}`, hasGetDisplayMedia,
      hasGetDisplayMedia ? 'Screen sharing code found' : 'Missing screen sharing',
      'Add navigator.mediaDevices.getDisplayMedia() calls');
    
    // Check for permission error handling
    const hasPermissionHandling = content.includes('NotAllowedError') ||
                                 content.includes('PermissionDeniedError') ||
                                 content.includes('permission');
    addResult('browser', `Permission handling in ${path.basename(filePath)}`, hasPermissionHandling,
      hasPermissionHandling ? 'Permission handling found' : 'Missing permission handling',
      'Add error handling for permission denied scenarios');
  });
}

// Run all validations
async function runValidation() {
  const envVars = validateEnvironmentVariables();
  validateSupabaseConfig();
  validateDatabaseSchema();
  validateWebRTCConfig();
  validateBrowserPermissions();
  
  // Summary
  console.log('\n📊 Validation Summary');
  console.log('===================');
  
  let totalTests = 0;
  let passedTests = 0;
  
  Object.entries(validationResults).forEach(([category, tests]) => {
    if (category === 'overall') return;
    
    const categoryPassed = tests.filter(t => t.passed).length;
    const categoryTotal = tests.length;
    
    totalTests += categoryTotal;
    passedTests += categoryPassed;
    
    const percentage = categoryTotal > 0 ? Math.round((categoryPassed / categoryTotal) * 100) : 0;
    const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';
    
    console.log(`${status} ${category}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
  });
  
  console.log('===================');
  const overallPercentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const overallStatus = overallPercentage >= 80 ? '✅' : overallPercentage >= 60 ? '⚠️' : '❌';
  
  console.log(`${overallStatus} Overall: ${passedTests}/${totalTests} tests passed (${overallPercentage}%)`);
  
  if (overallPercentage >= 80) {
    console.log('\n🎉 Environment is properly configured!');
  } else {
    console.log('\n⚠️ Environment needs attention. Check the issues above.');
  }
  
  return validationResults.overall;
}

// Main execution
if (import.meta.url === `file://${__filename}`) {
  runValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { runValidation, validateEnvironmentVariables, validateSupabaseConfig }; 