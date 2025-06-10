#!/usr/bin/env node

/**
 * Environment Setup Script
 * 
 * This script:
 * - Creates environment templates
 * - Validates current configuration
 * - Fixes common environment issues
 * - Sets up proper WebRTC and Supabase configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔧 Environment Setup and Validation Script');
console.log('==========================================\n');

// Environment template content
const envTemplate = `# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard

# WebRTC Configuration (Optional - defaults will be used if not provided)
# STUN Server (public Google STUN servers used by default)
VITE_STUN_SERVER=stun:stun.l.google.com:19302

# TURN Server (recommended for production to handle NAT/firewall traversal)
# VITE_TURN_SERVER=turn:your-turn-server.com:3478
# VITE_TURN_USERNAME=your-turn-username
# VITE_TURN_CREDENTIAL=your-turn-credential

# Connection Timeouts (milliseconds)
VITE_ICE_TIMEOUT=30000
VITE_CONNECTION_TIMEOUT=30000
VITE_GATHERING_TIMEOUT=15000
VITE_OFFER_TIMEOUT=10000
VITE_ANSWER_TIMEOUT=10000

# Retry Configuration
VITE_MAX_RETRY_ATTEMPTS=3
VITE_INITIAL_RETRY_DELAY=1000
VITE_MAX_RETRY_DELAY=8000
VITE_RETRY_BACKOFF_MULTIPLIER=2

# Performance Configuration
VITE_MAX_PARTICIPANTS=50
VITE_ADAPTIVE_BITRATE=true
VITE_SIMULCAST=true
VITE_DEGRADATION_PREFERENCE=maintain-framerate

# Debug Configuration
VITE_DEBUG_WEBRTC=false
VITE_LOG_LEVEL=info
VITE_STATS_INTERVAL=5000
VITE_LOG_SIGNALING=false

# Development Configuration
VITE_DEBUG_MODE=false
`;

// Browser permissions validation script
const permissionsTestHtml = `<!DOCTYPE html>
<html>
<head>
    <title>WebRTC Environment Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .pass { background-color: #d4edda; border: 1px solid #c3e6cb; }
        .fail { background-color: #f8d7da; border: 1px solid #f5c6cb; }
        .warn { background-color: #fff3cd; border: 1px solid #ffeaa7; }
        button { margin: 5px; padding: 10px; }
        video { width: 300px; height: 200px; border: 1px solid #ccc; margin: 5px; }
    </style>
</head>
<body>
    <h1>🔧 WebRTC Environment Test</h1>
    
    <div id="results"></div>
    
    <h2>Manual Tests</h2>
    <button onclick="testCamera()">Test Camera Access</button>
    <button onclick="testMicrophone()">Test Microphone Access</button>
    <button onclick="testScreenShare()">Test Screen Sharing</button>
    <button onclick="testWebRTC()">Test WebRTC Connection</button>
    
    <div id="videos"></div>
    
    <script>
        const results = document.getElementById('results');
        const videos = document.getElementById('videos');
        
        function addResult(test, status, message) {
            const div = document.createElement('div');
            div.className = 'test ' + status;
            div.innerHTML = '<strong>' + test + ':</strong> ' + message;
            results.appendChild(div);
        }
        
        // Automatic tests
        function runAutomaticTests() {
            // Test WebRTC support
            if (typeof RTCPeerConnection !== 'undefined') {
                addResult('WebRTC Support', 'pass', 'RTCPeerConnection is available');
            } else {
                addResult('WebRTC Support', 'fail', 'RTCPeerConnection is not available');
            }
            
            // Test getUserMedia support
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                addResult('getUserMedia Support', 'pass', 'navigator.mediaDevices.getUserMedia is available');
            } else {
                addResult('getUserMedia Support', 'fail', 'navigator.mediaDevices.getUserMedia is not available');
            }
            
            // Test getDisplayMedia support
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                addResult('Screen Sharing Support', 'pass', 'navigator.mediaDevices.getDisplayMedia is available');
            } else {
                addResult('Screen Sharing Support', 'warn', 'navigator.mediaDevices.getDisplayMedia is not available');
            }
            
            // Test WebSocket support
            if (typeof WebSocket !== 'undefined') {
                addResult('WebSocket Support', 'pass', 'WebSocket is available');
            } else {
                addResult('WebSocket Support', 'fail', 'WebSocket is not available');
            }
            
            // Test HTTPS
            if (location.protocol === 'https:' || location.hostname === 'localhost') {
                addResult('Secure Context', 'pass', 'Page is served over HTTPS or localhost');
            } else {
                addResult('Secure Context', 'fail', 'Page must be served over HTTPS for WebRTC to work');
            }
        }
        
        async function testCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;
                videos.appendChild(video);
                addResult('Camera Test', 'pass', 'Camera access granted');
            } catch (error) {
                addResult('Camera Test', 'fail', 'Camera access denied: ' + error.message);
            }
        }
        
        async function testMicrophone() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                addResult('Microphone Test', 'pass', 'Microphone access granted');
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                addResult('Microphone Test', 'fail', 'Microphone access denied: ' + error.message);
            }
        }
        
        async function testScreenShare() {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;
                videos.appendChild(video);
                addResult('Screen Share Test', 'pass', 'Screen sharing access granted');
            } catch (error) {
                addResult('Screen Share Test', 'fail', 'Screen sharing access denied: ' + error.message);
            }
        }
        
        async function testWebRTC() {
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                
                pc.oniceconnectionstatechange = () => {
                    addResult('WebRTC Connection', 'pass', 'ICE connection state: ' + pc.iceConnectionState);
                };
                
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                addResult('WebRTC Test', 'pass', 'WebRTC peer connection created successfully');
            } catch (error) {
                addResult('WebRTC Test', 'fail', 'WebRTC connection failed: ' + error.message);
            }
        }
        
        // Run automatic tests on load
        runAutomaticTests();
    </script>
</body>
</html>`;

// Environment fix suggestions
const fixSuggestions = {
  missingEnvVars: {
    title: "Missing Environment Variables",
    description: "Required environment variables are not set",
    fixes: [
      "1. Copy .env.template to .env: cp .env.template .env",
      "2. Edit .env file with your Supabase credentials",
      "3. Get credentials from https://supabase.com/dashboard",
      "4. Restart your development server"
    ]
  },
  
  invalidSupabaseUrl: {
    title: "Invalid Supabase URL",
    description: "Supabase URL format is incorrect",
    fixes: [
      "1. Check your Supabase project URL",
      "2. Format should be: https://[project-id].supabase.co",
      "3. Find correct URL in Supabase dashboard > Settings > API"
    ]
  },
  
  invalidJwtToken: {
    title: "Invalid JWT Token",
    description: "Supabase anon key format is incorrect",
    fixes: [
      "1. Check your Supabase anon key",
      "2. Should be a long JWT token with 3 parts separated by dots",
      "3. Find correct key in Supabase dashboard > Settings > API > anon public"
    ]
  },
  
  missingTurnServer: {
    title: "Missing TURN Server",
    description: "No TURN server configured for production",
    fixes: [
      "1. Set up a TURN server (coturn, Twilio, etc.)",
      "2. Add TURN configuration to .env:",
      "   VITE_TURN_SERVER=turn:your-server.com:3478",
      "   VITE_TURN_USERNAME=username",
      "   VITE_TURN_CREDENTIAL=password",
      "3. For development, STUN servers are sufficient"
    ]
  },
  
  httpsRequired: {
    title: "HTTPS Required",
    description: "WebRTC requires HTTPS in production",
    fixes: [
      "1. Serve your app over HTTPS",
      "2. Use localhost for development",
      "3. Configure SSL certificate for production",
      "4. Consider using Vercel, Netlify, or similar for easy HTTPS"
    ]
  },
  
  browserPermissions: {
    title: "Browser Permissions",
    description: "Camera/microphone permissions needed",
    fixes: [
      "1. Grant camera/microphone permissions when prompted",
      "2. Check browser permission settings",
      "3. Ensure HTTPS or localhost for secure context",
      "4. Test with webrtc-test.html in browser"
    ]
  }
};

// Functions
function createEnvTemplate() {
  const templatePath = path.join(projectRoot, '.env.template');
  
  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, envTemplate);
    console.log('✅ Created .env.template');
  } else {
    console.log('ℹ️  .env.template already exists');
  }
  
  return templatePath;
}

function createWebRTCTest() {
  const testPath = path.join(projectRoot, 'webrtc-test.html');
  
  fs.writeFileSync(testPath, permissionsTestHtml);
  console.log('✅ Created webrtc-test.html for browser testing');
  
  return testPath;
}

function checkEnvironmentFiles() {
  const envPath = path.join(projectRoot, '.env');
  const envLocalPath = path.join(projectRoot, '.env.local');
  
  const hasEnv = fs.existsSync(envPath);
  const hasEnvLocal = fs.existsSync(envLocalPath);
  
  console.log(`\n📁 Environment Files:`);
  console.log(`   .env: ${hasEnv ? '✅ Found' : '❌ Missing'}`);
  console.log(`   .env.local: ${hasEnvLocal ? '✅ Found' : 'ℹ️  Optional'}`);
  
  if (!hasEnv && !hasEnvLocal) {
    console.log('\n🔧 Fix: Copy template to create .env file');
    console.log('   cp .env.template .env');
    return false;
  }
  
  return true;
}

function validateEnvironmentVariables() {
  console.log('\n🔍 Validating Environment Variables...');
  
  // Try to read .env files
  let envVars = {};
  
  ['.env', '.env.local'].forEach(filename => {
    const filepath = path.join(projectRoot, filename);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      });
    }
  });
  
  const issues = [];
  
  // Check required variables
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !envVars[key]);
  
  if (missing.length > 0) {
    issues.push('missingEnvVars');
    console.log(`❌ Missing variables: ${missing.join(', ')}`);
  } else {
    console.log('✅ All required variables present');
  }
  
  // Validate Supabase URL
  if (envVars.VITE_SUPABASE_URL) {
    const urlPattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
    if (!urlPattern.test(envVars.VITE_SUPABASE_URL)) {
      issues.push('invalidSupabaseUrl');
      console.log('❌ Invalid Supabase URL format');
    } else {
      console.log('✅ Valid Supabase URL format');
    }
  }
  
  // Validate JWT token
  if (envVars.VITE_SUPABASE_ANON_KEY) {
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    if (!jwtPattern.test(envVars.VITE_SUPABASE_ANON_KEY)) {
      issues.push('invalidJwtToken');
      console.log('❌ Invalid JWT token format');
    } else {
      console.log('✅ Valid JWT token format');
    }
  }
  
  // Check TURN server for production
  const hasTurnServer = envVars.VITE_TURN_SERVER && 
                       envVars.VITE_TURN_USERNAME && 
                       envVars.VITE_TURN_CREDENTIAL;
  
  if (!hasTurnServer) {
    issues.push('missingTurnServer');
    console.log('⚠️  No TURN server configured (recommended for production)');
  } else {
    console.log('✅ TURN server configured');
  }
  
  return { issues, envVars };
}

function showFixSuggestions(issues) {
  if (issues.length === 0) {
    console.log('\n🎉 Environment is properly configured!');
    return;
  }
  
  console.log('\n🔧 Fix Suggestions:');
  console.log('==================');
  
  issues.forEach(issueKey => {
    const issue = fixSuggestions[issueKey];
    if (issue) {
      console.log(`\n❌ ${issue.title}`);
      console.log(`   ${issue.description}`);
      console.log('   Fixes:');
      issue.fixes.forEach(fix => console.log(`   ${fix}`));
    }
  });
}

function createSetupGuide() {
  const guide = `# Environment Setup Guide

## Quick Start

1. **Copy environment template:**
   \`\`\`bash
   cp .env.template .env
   \`\`\`

2. **Edit .env with your Supabase credentials:**
   - Get URL and anon key from https://supabase.com/dashboard
   - Project Settings > API

3. **Test WebRTC functionality:**
   - Open webrtc-test.html in your browser
   - Grant camera/microphone permissions
   - Verify all tests pass

4. **Run validation:**
   \`\`\`bash
   node scripts/setup-environment.js
   \`\`\`

## Production Setup

### TURN Server Configuration

For production deployments, configure TURN servers:

\`\`\`bash
# Option 1: Use Twilio TURN servers
VITE_TURN_SERVER=turn:global.turn.twilio.com:3478
VITE_TURN_USERNAME=your-twilio-username
VITE_TURN_CREDENTIAL=your-twilio-credential

# Option 2: Set up your own coturn server
VITE_TURN_SERVER=turn:your-server.com:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
\`\`\`

### HTTPS Requirements

WebRTC requires HTTPS in production:
- Use deployment platforms like Vercel, Netlify
- Or configure SSL certificates manually
- Localhost works for development

### Database Setup

1. **Deploy Supabase migrations:**
   \`\`\`bash
   supabase db push
   \`\`\`

2. **Deploy edge functions:**
   \`\`\`bash
   supabase functions deploy
   \`\`\`

## Troubleshooting

- **Permissions denied:** Check browser permissions and HTTPS
- **Connection failed:** Verify STUN/TURN server configuration
- **Database errors:** Check RLS policies and environment variables
- **Function errors:** Verify edge function deployment

## Testing

Run environment validation:
\`\`\`bash
node scripts/validate-environment.js
\`\`\`

Open browser test:
\`\`\`bash
open webrtc-test.html
\`\`\`
`;

  const guidePath = path.join(projectRoot, 'ENVIRONMENT_SETUP.md');
  fs.writeFileSync(guidePath, guide);
  console.log('✅ Created ENVIRONMENT_SETUP.md');
  
  return guidePath;
}

// Main execution
async function main() {
  try {
    // Create necessary files
    createEnvTemplate();
    createWebRTCTest();
    createSetupGuide();
    
    // Check and validate environment
    const hasEnvFiles = checkEnvironmentFiles();
    
    if (hasEnvFiles) {
      const { issues } = validateEnvironmentVariables();
      showFixSuggestions(issues);
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Edit .env file with your Supabase credentials');
    console.log('2. Open webrtc-test.html in browser to test WebRTC');
    console.log('3. Run: node scripts/validate-environment.js');
    console.log('4. Read ENVIRONMENT_SETUP.md for detailed instructions');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${__filename}`) {
  main();
} 