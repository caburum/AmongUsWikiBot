import { mwn } from 'mwn';
const path = require('path');
const { version } = require('./package.json');

const ratelimit = 3 * 1000;

const bot = new mwn({
	apiUrl: 'https://among-us.fandom.com/api.php',
	username: process.env.username,
	password: process.env.password,
	userAgent: `Among Us Wiki Bot/${version} (User:Caburum) mwn/0.10.4`, // https://meta.wikimedia.org/wiki/User-Agent_policy

	defaultParams: { // Set default parameters to be sent to be included in every API request
		assert: 'user' // Ensure we're logged in
	}
});

bot.setOptions({
	silent: true, // Suppress built-in messages (except error messages)
	retryPause: 5000, // Pause for 5000ms on maxlag error
	maxRetries: 3, // Attempt to retry a failing requests up to 3 times
	editConfig: {
		suppressNochangeWarning: true, // Suppress default no change messages
		exclusionRegex: /\{\{nobots\}\}/i // Use {{nobots}}
	}
});

bot.enableEmergencyShutoff({
	page: 'User:' + bot.options.username!.match(/.*(?=@)/)![0] + '/shutoff',
	intervalDuration: 5 * 1000,
	condition: function(pagetext: string) {
		if (pagetext.includes('EMERGENCY SHUTOFF')) {
			return false;
		} else return true;
	},
	onShutoff: function() {
		console.log('\x1b[91m' + 'EMERGENCY SHUTOFF' + '\x1b[39m');
		process.exit();
	}
});

// Load all edit modules
var modules: any[] = [];
require('fs').readdirSync(path.resolve('./modules/')).forEach(function(modulePath: string) {
	if (modulePath.match(/.*\.(?<!disabled\.)(?:js|ts)/)) {
		modules.push(require(path.resolve('./modules/' + modulePath)));
	}
});

// Login
bot.login().then(async function(response) {
	if (response.result !== 'Success') return;
	mwn.log(`[S] [mwn] Login successful: ${bot.options.username}@${bot.options.apiUrl?.split('/api.php').join('')}`)
	// Get all pages
	var pages: { pageid: number, ns: number, title: string }[] = await bot.request({
		action: 'query',
		list: 'allpages',
		prop: 'info',
		aplimit: 5000
	}).then((data) => {
		mwn.log(`[i] Loaded ${data.query?.allpages.length} pages`);
		return data.query?.allpages;
	});
	// pages = [{title: 'User:Caburum/Sandbox', pageid: 0, ns: 2}] // this bot is dangerous and must be contained to the safe zone

	// Run through each page with a ratelimit
	const scheduleEdit = (i: number) => {
		if (i < pages.length) {
			processPage(pages[i].title);
			i++;
			setTimeout(scheduleEdit, ratelimit, i);
		} else {
			process.exit(0); // Done
		}
	}
	scheduleEdit(0);
});

async function processPage(title: string) {
	await bot.edit(title, (rev) => {
		let pageContent: string = rev.content; // Original content
		let pageEdit: string = pageContent; // Content to be edited
		let summaryChanges: string[] = [];
		modules.forEach((module: any) => { // Run page through each module to stage edits
			let thisModuleEdit: string = module.default(pageEdit, title);
			if (pageEdit != thisModuleEdit) { // A change was made
				pageEdit = thisModuleEdit;
				summaryChanges.push(module.summary);
			}
		});
		return {
			text: pageEdit,
			summary: `Automated: ${summaryChanges.join(', ')}`
		}
	}).then((data) => {
		if (data.result == 'Success' && !data.nochange) {
			mwn.log(`[S] Successfully edited ${data.title} (revision ${data.newrevid})`);
		} else if (data.result == 'Success' && data.nochange) {
			mwn.log(`[W] No change from edit to ${data.title}`);
		}
	});
}