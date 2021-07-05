import { mwn, ApiPage } from 'mwn';
import axios from 'axios';
const path = require('path');

const ratelimit = 3 * 1000;

const bot = new mwn({
	apiUrl: process.env.apiUrl,
	username: process.env.username,
	password: process.env.password,
	userAgent: `${require('./package.json').name}/${require('./package.json').version} ${process.env.operator ? `(User:${process.env.operator})` : ''}mwn/${require('./node_modules/mwn/package.json').version}`, // https://meta.wikimedia.org/wiki/User-Agent_policy

	defaultParams: { // Set default parameters to be sent to be included in every API request
		assert: 'user' // Ensure we're logged in
	}
});

bot.setOptions({
	silent: true, // Suppress built-in messages (except error messages)
	retryPause: 5000, // Pause for 5000ms on maxlag error
	maxRetries: 1, // Attempt to retry a failing requests up to x times
	editConfig: {
		suppressNochangeWarning: true, // Suppress default no change messages
		exclusionRegex: /\{\{nobots\}\}/i // Use {{nobots}}
	}
});

// Load all edit modules
var modules: any[] = [];
require('fs').readdirSync(path.resolve('./modules/')).forEach(function(modulePath: string) {
	if (modulePath.match(/.*\.(?<!disabled\.)(?:js|ts)/)) {
		modules.push(require(path.resolve('./modules/' + modulePath)));
	}
});

var replaces: ReplaceObject[] = [];
modules.push({
	default: function(text: string) {
		replaces.forEach((replace) => {
			text = text.replace(replace.find, replace.replace);
		})
		return text;
	},
	summary: '[[Project:Bots/config|replaces]]'
});

// Login
bot.login().then(async function(response) {
	if (response.result !== 'Success') return;
	mwn.log(`[S] [mwn] Login successful: ${bot.options.username}@${bot.options.apiUrl?.split('/api.php').join('')}`);

	var config = await loadConfig() || { approvedBots: [], replaces: [] };
	replaces = config.replaces;
	
	if (config.approvedBots.length && !config.approvedBots.includes(bot.state.lgusername)) return mwn.log('[E] User account is not approved on this wiki. Please contact your local administrator.');

	bot.read(`User:${bot.state.lgusername}/shutoff`).then((data) => {
		if (data.missing) return;
		bot.enableEmergencyShutoff({
			page: data.title,
			intervalDuration: 4 * ratelimit,
			condition: function(pagetext: string) {
				if (pagetext.includes('EMERGENCY SHUTOFF')) {
					return false;
				} else return true;
			},
			onShutoff: function() {
				mwn.log('[E] EMERGENCY SHUTOFF');
				process.exit();
			}
		});
	})

	// Get all pages
	var pages: { pageid: number, ns: number, title: string }[] = await bot.request({
		action: 'query',
		list: 'allpages',
		prop: 'info',
		aplimit: 'max'
	}).then((data) => {
		mwn.log(`[i] Loaded ${data.query?.allpages.length} pages`);
		return data.query?.allpages;
	});

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

async function loadConfig(): Promise<{ approvedBots: string[], replaces: ReplaceObject[] } | void> {
	var configPage: ApiPage = await bot.read('Project:Bots/config');	
	var configData: string = configPage.revisions?.[0].content || '';
	if (configPage.missing || !configData) return mwn.log('[i] No config page');
	mwn.log('[i] Loaded config page');

	var approvedBots = JSON.parse((configData.match(/(?<=<!-- ?approved-bots ?-->).*(?=<!-- ?approved-bots-end ?-->)/s)?.[0] || '[]').trim());

	var replaceMatches = JSON.parse((configData.match(/(?<=<!-- ?replaces ?-->).*(?=<!-- ?replaces-end ?-->)/s)?.[0] || '[]').trim());
	var replacesArray: ReplaceObject[] = [];

	await Promise.all(replaceMatches.map(async (replace: string | object) => {
		let myReplaces: ReplaceObject[] = [];
		if (typeof replace === 'string') { // Extra JSON page
			if (/https?:\/\/.+/.test(replace)) { // External URL
				await axios
					.request({
						url: replace
					})
					.then((response: any) => {
						console.log()
						if (typeof response.data === 'object') {
							myReplaces = response.data;
						} else {
							return mwn.log('[W] No valid JSON in external replaces URL: ' + replace);
						}
					})
					.catch((err) => {
						return mwn.log('[E] Error while fetching external replaces URL: ' + replace);
					})
			} else { // Internal wiki page
				let replacePage: ApiPage = await bot.read(replace);
				if (replacePage.missing) return mwn.log('[W] Replaces page not found: ' + replace);
				try {
					myReplaces = JSON.parse(replacePage.revisions?.[0].content || '');
				} catch {
					return mwn.log('[W] No valid JSON in replaces page: ' + replace);
				}
			}
		}
		await Promise.all(myReplaces.map((item, i) => { // Validate replace objects
			if (typeof item.find === 'string' && typeof item.replace === 'string') { // Valid
				item.find = new RegExp(item.find, 'g');
			} else { // Invalid, remove the item
				myReplaces.splice(i, 1);
			}
		}));
		replacesArray = replacesArray.concat(myReplaces);
	}));

	if (!replacesArray) { mwn.log('[i] No replaces loaded') }
	else { mwn.log(`[i] Loaded ${replacesArray.length} replaces`) };
	return {approvedBots, replaces: replacesArray};
}

interface ReplaceObject extends Object {
	name?: string;
	find: string | RegExp;
	replace: string;
}