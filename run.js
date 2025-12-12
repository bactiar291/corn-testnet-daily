const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const { ethers } = require("ethers");
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');

class TwitterHandler {
  constructor() {
    this.twitterConfigs = [];
    this.loadTwitterConfig();
  }

  loadTwitterConfig() {
    try {
      if (fs.existsSync('x.txt')) {
        const data = fs.readFileSync('x.txt', 'utf8');
        const lines = data.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        this.twitterConfigs = lines.map((line, index) => {
          const [appKey, appSecret, accessToken, accessSecret, name = `Twitter ${index + 1}`] = line.split('|').map(field => field.trim());
          return {
            appKey,
            appSecret,
            accessToken,
            accessSecret,
            name,
            index: index
          };
        });
        console.log(`âœ… Loaded ${this.twitterConfigs.length} Twitter config(s)`);
      } else {
        console.log('âš ï¸  File x.txt not found');
      }
    } catch (error) {
      console.log('âŒ Failed to load Twitter config:', error.message);
    }
  }

  getConfigByIndex(index) {
    if (this.twitterConfigs.length === 0) return null;
    return this.twitterConfigs[index] || this.twitterConfigs[0];
  }

  generateRandomTweet() {
    const intros = [
      "Just discovered", "Excited about", "Loving", "Can't stop using",
      "Really impressed with", "Been exploring", "Just joined", "Having fun with"
    ];
    
    const subjects = [
      "the ecosystem", "this platform", "the community", "web3 rewards",
      "blockchain rewards", "this project", "loyalty platform", "the future"
    ];
    
    const actions = [
      "building", "growing", "connecting", "earning", "exploring",
      "learning", "engaging", "contributing", "participating"
    ];
    
    const adjectives = [
      "amazing", "incredible", "awesome", "fantastic", "great",
      "solid", "promising", "innovative", "exciting", "powerful"
    ];

    const templates = [
      `${this.randomFrom(intros)} ${this.randomFrom(subjects)} ${this.randomFrom(actions)} with @use_corn ${this.randomFrom(adjectives)} experience!`,
      `${this.randomFrom(intros)} @use_corn! ${this.randomFrom(adjectives)} ${this.randomFrom(subjects)} for ${this.randomFrom(actions)} together!`,
      `@use_corn ${this.randomFrom(subjects)} is ${this.randomFrom(adjectives)}! ${this.randomFrom(intros)} ${this.randomFrom(actions)} here!`,
      `${this.randomFrom(actions)} on @use_corn ${this.randomFrom(adjectives)} ${this.randomFrom(subjects)} ${this.randomFrom(intros)} today!`,
      `${this.randomFrom(adjectives)} ${this.randomFrom(subjects)} on @use_corn! ${this.randomFrom(intros)} ${this.randomFrom(actions)} now!`
    ];

    return this.randomFrom(templates);
  }

  randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  async createTweet(config, text, maxRetries = 3) {
    if (!config) {
      console.log('   âš ï¸  No Twitter config available');
      return { success: false, error: 'no_config' };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   ðŸ“ Posting tweet (try ${attempt}/${maxRetries})...`);
        console.log(`   ðŸ’¬ "${text}"`);
        
        const client = new TwitterApi({
          appKey: config.appKey,
          appSecret: config.appSecret,
          accessToken: config.accessToken,
          accessSecret: config.accessSecret,
        });

        const rwClient = client.readWrite;
        const response = await rwClient.v2.tweet(text);
        const id = response?.data?.id;
        const tweetUrl = `https://x.com/i/web/status/${id}`;
        
        console.log(`   âœ… Tweet posted!`);
        console.log(`   ðŸ”— Link: ${tweetUrl}`);
        return { success: true, id, text, tweetUrl, config: config.name };
        
      } catch (error) {
        const statusCode = error.code || error.response?.status;
        
        if (statusCode === 429 || error.message?.includes('rate limit')) {
          const waitTime = Math.min(attempt * 60000, 300000);
          console.log(`   â³ Rate limit! Waiting ${waitTime/1000}s...`);
          await this.wait(waitTime);
          continue;
        }
        
        if (statusCode === 403 || error.message?.includes('duplicate')) {
          console.log(`   âš ï¸  Duplicate tweet or permission issue`);
          return { success: false, error: 'duplicate_or_permission' };
        }
        
        console.log(`   âŒ Failed to post tweet: ${error.message}`);
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 15000;
          await this.wait(waitTime);
        } else {
          return { success: false, error: error.message };
        }
      }
    }
    
    return { success: false, error: 'max_retries_exceeded' };
  }

  async deleteTweet(config, tweetId, maxRetries = 3) {
    if (!config) {
      return { success: false, error: 'no_config' };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = new TwitterApi({
          appKey: config.appKey,
          appSecret: config.appSecret,
          accessToken: config.accessToken,
          accessSecret: config.accessSecret,
        });

        const rwClient = client.readWrite;
        await rwClient.v2.deleteTweet(tweetId);
        console.log(`   ðŸ—‘ï¸  Tweet deleted (ID: ${tweetId})`);
        return { success: true };
      } catch (error) {
        const statusCode = error.code || error.response?.status;
        
        if (statusCode === 429) {
          await this.wait(Math.min(attempt * 30000, 300000));
          continue;
        }
        
        if (attempt < maxRetries) {
          await this.wait(15000);
        } else {
          return { success: false, error: error.message };
        }
      }
    }
    
    return { success: false, error: 'max_retries_exceeded' };
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.loadProxies();
  }

  loadProxies() {
    try {
      if (fs.existsSync('proxy.txt')) {
        const data = fs.readFileSync('proxy.txt', 'utf8');
        this.proxies = data.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(proxy => proxy.trim());
        
        console.log(`âœ… Loaded ${this.proxies.length} proxy/proxies`);
      } else {
        console.log('âš ï¸  File proxy.txt not found - running without proxy');
      }
    } catch (error) {
      console.log('âŒ Failed to load proxies:', error.message);
    }
  }

  normalizeProxy(proxy) {
    if (!proxy) return null;
    
    if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
      return proxy;
    }
    
    const parts = proxy.split(':');
    if (parts.length === 4) {
      return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
    } else if (parts.length === 2) {
      return `http://${parts[0]}:${parts[1]}`;
    } else if (proxy.includes('@')) {
      return `http://${proxy}`;
    }
    
    return `http://${proxy}`;
  }

  getProxyByIndex(index) {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[index] || this.proxies[0];
    return this.normalizeProxy(proxy);
  }

  getAxiosConfig(proxy) {
    if (!proxy) return {};
    
    try {
      return {
        httpsAgent: new HttpsProxyAgent(proxy),
        proxy: false
      };
    } catch (error) {
      console.log(`   âŒ Failed to create proxy agent: ${error.message}`);
      return {};
    }
  }
}

class CornBot {
  constructor() {
    this.BASE_API = "https://loyalty.usecorn.com/api";
    this.WEB_ID = "8e54cfff-37f1-4d29-b025-8f8aaa1fd331";
    this.ORG_ID = "c798ad76-e2ba-4ed9-9798-4894facd2c2f";
    this.REF_CODE = "115RBQG9";
    this.accounts = [];
    this.twitterHandler = new TwitterHandler();
    this.proxyManager = new ProxyManager();
    this.loadAccounts();
  }

  loadAccounts() {
    try {
      if (!fs.existsSync('accounts.txt')) {
        console.log('âŒ File accounts.txt not found!');
        return;
      }

      const data = fs.readFileSync('accounts.txt', 'utf8');
      const lines = data.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      this.accounts = lines.map((line, index) => {
        const privateKey = line.trim();
        const wallet = new ethers.Wallet(privateKey);
        
        const twitterConfig = this.twitterHandler.getConfigByIndex(index);
        
        const proxy = this.proxyManager.getProxyByIndex(index);
        
        return {
          id: index + 1,
          privateKey,
          address: wallet.address,
          name: `Account ${index + 1}`,
          twitterConfig,
          proxy,
          proxyString: proxy ? proxy.replace(/\/\/.*:.*@/, '//***:***@') : 'No Proxy'
        };
      });

      console.log(`âœ… Loaded ${this.accounts.length} account(s)`);
      
      this.validateConfigurations();
    } catch (error) {
      console.log('âŒ Failed to load accounts:', error.message);
    }
  }

  validateConfigurations() {
    console.log('\nðŸ“‹ Configuration Summary:');
    console.log('='.repeat(70));
    
    this.accounts.forEach((account, index) => {
      const twitterStatus = account.twitterConfig ? 'âœ…' : 'âŒ';
      const proxyStatus = account.proxy ? 'âœ…' : 'âš ï¸ ';
      
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   Wallet: ${this.maskAddress(account.address)}`);
      console.log(`   Twitter: ${twitterStatus} ${account.twitterConfig?.name || 'No Config'}`);
      console.log(`   Proxy: ${proxyStatus} ${account.proxyString}`);
      console.log('');
    });
    
    const missingTwitter = this.accounts.filter(a => !a.twitterConfig).length;
    const missingProxy = this.accounts.filter(a => !a.proxy).length;
    
    if (missingTwitter > 0) {
      console.log(`âš ï¸  Warning: ${missingTwitter} account(s) without Twitter configuration`);
    }
    if (missingProxy > 0) {
      console.log(`âš ï¸  Warning: ${missingProxy} account(s) without proxy`);
    }
    
    console.log('='.repeat(70));
  }

  maskAddress(address) {
    return `${address.substring(0, 6)}******${address.slice(-6)}`;
  }

  async getHeaders(address, cookie = '') {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Origin': 'https://loyalty.usecorn.com',
      'Referer': 'https://loyalty.usecorn.com/quest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };
  }

  generatePayload(privateKey, address, csrfToken) {
    const issuedAt = new Date().toISOString().slice(0, 23) + 'Z';

    const rawMessage = JSON.stringify({
      domain: "loyalty.usecorn.com",
      address: address,
      statement: "Sign in to the app. Powered by Snag Solutions.",
      uri: "https://loyalty.usecorn.com",
      version: "1",
      chainId: 1,
      nonce: csrfToken,
      issuedAt: issuedAt
    });

    const message = 
      `loyalty.usecorn.com wants you to sign in with your Ethereum account:\n` +
      `${address}\n\n` +
      `Sign in to the app. Powered by Snag Solutions.\n\n` +
      `URI: https://loyalty.usecorn.com\n` +
      `Version: 1\n` +
      `Chain ID: 1\n` +
      `Nonce: ${csrfToken}\n` +
      `Issued At: ${issuedAt}`;

    const wallet = new ethers.Wallet(privateKey);
    const signature = wallet.signMessageSync(message);

    return {
      message: rawMessage,
      accessToken: signature,
      signature: signature,
      walletConnectorName: "MetaMask",
      walletAddress: address,
      redirect: "false",
      callbackUrl: "/protected",
      chainType: "evm",
      walletProvider: "undefined",
      csrfToken: csrfToken,
      json: "true"
    };
  }

  async authCsrf(account, cookie) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/auth/csrf`;
      
      const headers = {
        ...await this.getHeaders(account.address, cookie),
        'Content-Type': 'application/json'
      };

      const response = await axios.get(url, {
        headers: headers,
        ...proxyConfig
      });

      const csrfToken = response.data.csrfToken;
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const parsedCookies = cookies.map(c => c.split(';')[0]).join('; ');
        cookie += `; ${parsedCookies}`;
      }

      return { success: true, csrfToken, cookie };
    } catch (error) {
      console.log('   âŒ Failed to get CSRF:', error.message);
      return { success: false };
    }
  }

  async authCredentials(account, csrfToken, cookie) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/auth/callback/credentials`;
      const payload = this.generatePayload(account.privateKey, account.address, csrfToken);
      
      const response = await axios.post(
        url,
        new URLSearchParams(payload),
        {
          headers: {
            ...await this.getHeaders(account.address, cookie),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 0,
          validateStatus: () => true,
          ...proxyConfig
        }
      );

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const parsedCookies = cookies.map(c => c.split(';')[0]).join('; ');
        cookie += `; ${parsedCookies}`;
      }

      const sessionCookie = cookies?.find(c => c.includes('__Secure-next-auth.session-token'));
      if (!sessionCookie) {
        console.log('   âŒ Login failed: No session token received');
        return { success: false };
      }

      return { success: true, cookie };
    } catch (error) {
      console.log('   âŒ Login failed:', error.message);
      return { success: false };
    }
  }

  async getLoyaltyAccount(account, cookie) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/loyalty/accounts?websiteId=${this.WEB_ID}&organizationId=${this.ORG_ID}&walletAddress=${account.address}`;
      
      const response = await axios.get(url, {
        headers: await this.getHeaders(account.address, cookie),
        ...proxyConfig
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        const loyaltyData = response.data.data[0];
        console.log(`   ðŸ’° Points Balance: ${loyaltyData.amount || 0}`);
        return { success: true, data: loyaltyData };
      }
      
      return { success: false };
    } catch (error) {
      console.log('   âŒ Failed to get loyalty account:', error.message);
      return { success: false };
    }
  }

  async completeCheckin(account, cookie) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/loyalty/rules/799c40a7-aff8-4aee-9585-eb88149198d8/complete`;
      
      const response = await axios.post(
        url,
        {},
        {
          headers: await this.getHeaders(account.address, cookie),
          validateStatus: () => true,
          ...proxyConfig
        }
      );

      if (response.status === 400) {
        console.log('   âš ï¸  Daily Check-In: Already Claimed');
        return { success: false, already_claimed: true };
      }

      console.log('   âœ… Daily Check-In: Success');
      return { success: true, data: response.data };
    } catch (error) {
      console.log('   âŒ Daily Check-In failed:', error.message);
      return { success: false };
    }
  }

  async checkTweetQuestStatus(account, cookie) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/loyalty/rules/eb86fe9c-a379-4555-927f-03994ccca25e/complete`;

      const payload = {
        contentUrl: "https://x.com/dummy/status/12345"
      };

      const response = await axios.post(
        url,
        payload,
        {
          headers: await this.getHeaders(account.address, cookie),
          validateStatus: () => true,
          ...proxyConfig
        }
      );

      if (response.status === 400) {
        console.log('   âš ï¸  Tweet Quest: Already Claimed (Skip for today)');
        return { already_claimed: true };
      }

      if (response.status === 200) {
        if (response.data.message && response.data.message.includes("already completed")) {
          console.log('   âš ï¸  Tweet Quest: Already Claimed (Skip for today)');
          return { already_claimed: true };
        }
      }

      console.log('   âœ… Tweet Quest: Not claimed yet');
      return { already_claimed: false };
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400) {
          console.log('   âš ï¸  Tweet Quest: Already Claimed (Skip for today)');
          return { already_claimed: true };
        }
        console.log('   âŒ Error checking tweet quest:', error.response.status);
      } else {
        console.log('   âŒ Error checking tweet quest:', error.message);
      }
      return { already_claimed: false };
    }
  }

  async claimTweetQuest(account, cookie, tweetUrl) {
    try {
      const proxyConfig = this.proxyManager.getAxiosConfig(account.proxy);
      const url = `${this.BASE_API}/loyalty/rules/eb86fe9c-a379-4555-927f-03994ccca25e/complete`;

      const payload = {
        contentUrl: tweetUrl
      };

      console.log(`   ðŸŽ¯ Claiming tweet quest with URL: ${tweetUrl}`);

      const response = await axios.post(
        url,
        payload,
        {
          headers: await this.getHeaders(account.address, cookie),
          validateStatus: () => true,
          ...proxyConfig
        }
      );

      if (response.status === 200) {
        if (response.data.message === "Completion request added to queue") {
          console.log('   âœ… Tweet Quest: Success - Added to queue');
          return { success: true, data: response.data };
        } else if (response.data.message && response.data.message.includes("already completed")) {
          console.log('   âš ï¸  Tweet Quest: Already Claimed');
          return { success: false, already_claimed: true };
        }
      } else if (response.status === 400) {
        console.log('   âš ï¸  Tweet Quest: Already Claimed or Invalid');
        return { success: false, already_claimed: true };
      }

      console.log('   âœ… Tweet Quest: Success');
      return { success: true, data: response.data };
    } catch (error) {
      console.log('   âŒ Tweet Quest failed:', error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
      return { success: false };
    }
  }

  async processAccount(account) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`ðŸ”„ Processing: ${account.name}`);
    console.log(`ðŸ“ Address: ${this.maskAddress(account.address)}`);
    console.log(`ðŸ¦ Twitter: ${account.twitterConfig?.name || 'No Config'}`);
    console.log(`ðŸ”Œ Proxy: ${account.proxyString}`);
    console.log('='.repeat(70));

    if (!account.twitterConfig) {
      console.log('   âŒ No Twitter configuration for this account - Skipping tweet tasks');
      console.log(`\nâš ï¸  ${account.name} completed (without tweet tasks)!`);
      return;
    }

    let cookie = `referral_code=${this.REF_CODE}`;

    const csrf = await this.authCsrf(account, cookie);
    if (!csrf.success) return;

    const login = await this.authCredentials(account, csrf.csrfToken, csrf.cookie);
    if (!login.success) return;
    
    console.log('   âœ… Login Success');

    const loyalty = await this.getLoyaltyAccount(account, login.cookie);
    
    const checkin = await this.completeCheckin(account, login.cookie);

    console.log(`\n   ðŸ” Checking tweet quest status...`);
    const tweetQuestStatus = await this.checkTweetQuestStatus(account, login.cookie);
    
    if (tweetQuestStatus.already_claimed) {
      console.log(`   â­ï¸  Tweet quest already claimed - Skipping to next account`);
      console.log(`\nâœ… ${account.name} completed (tweet quest already claimed)!`);
      return;
    }

    console.log(`\n   ðŸ¦ Twitter Task: Post about Corn`);
    
    const randomTweet = this.twitterHandler.generateRandomTweet();
    const tweetResult = await this.twitterHandler.createTweet(account.twitterConfig, randomTweet);
    
    if (tweetResult.success) {
      console.log(`   âœ… Tweet posted successfully!`);
      
      console.log(`   â³ Waiting 30 seconds before claiming quest...`);
      await this.twitterHandler.wait(30000); 
      
      const claimResult = await this.claimTweetQuest(account, login.cookie, tweetResult.tweetUrl);
      
      if (claimResult.success) {
        console.log(`   âœ… Tweet quest claimed successfully!`);
      } else if (claimResult.already_claimed) {
        console.log(`   âš ï¸  Tweet quest already claimed`);
      } else {
        console.log(`   âŒ Failed to claim tweet quest`);
      }
      
      if (claimResult.success || claimResult.already_claimed) {
        console.log(`   â³ Waiting 30 seconds before deleting tweet...`);
        await this.twitterHandler.wait(30000); 
        
        const deleteResult = await this.twitterHandler.deleteTweet(account.twitterConfig, tweetResult.id);
        if (deleteResult.success) {
          console.log(`   âœ… Tweet deleted successfully!`);
        }
      }
    } else {
      console.log(`   âš ï¸  Failed to post tweet - skipping claim`);
    }

    console.log(`\nâœ… ${account.name} completed!`);
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async countdown(seconds, message = "Next run in") {
    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\râ° ${message}: ${this.formatTime(i)} `);
      await this.twitterHandler.wait(1000);
    }
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }

  async main() {
    console.log('\nðŸŒ½ Corn Loyalty Auto BOT');
    console.log('ðŸ‘¤ Bactiar291');
    console.log('='.repeat(70));

    if (this.accounts.length === 0) {
      console.log('âŒ No accounts found!');
      return;
    }

    while (true) {
      for (const account of this.accounts) {
        await this.processAccount(account);
        
        if (this.accounts.indexOf(account) < this.accounts.length - 1) {
          console.log('\nâ³ Waiting 30 seconds before next account...');
          await this.countdown(30, "Next account in");
        }
      }

      console.log('\nðŸŽ‰ All accounts processed!');
      console.log('â° Waiting 24 hours for next cycle...\n');
      
      const waitTime = (24 * 60 * 60) + (5 * 60);
      await this.countdown(waitTime, "Next cycle in");
      
      this.twitterHandler.loadTwitterConfig();
      this.proxyManager.loadProxies();
      console.log('\nðŸ”„ Reloading configurations for next cycle...');
    }
  }
}

const bot = new CornBot();
bot.main().catch(console.error);
