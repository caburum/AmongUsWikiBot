import { mwn, ApiPage } from 'mwn';
import { request } from 'undici';
import * as path from 'path';

import type { MwnError } from 'mwn/build/error';

const logAll = false; // log non-changes
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

var config: {
	approvedBots: string[],
	replaces: ReplaceObject[],
	namespaces: number[],
	disabledModules: string[],
	[key: string]: any
} = {
	approvedBots: [],
	replaces: [],
	namespaces: [0],
	disabledModules: ['convert interwiki to template']
};
var modules: any[] = [];

// Login
bot.login().then(async function(response) {
	if (response.result !== 'Success') return;
	mwn.log(`[S] [mwn] Login successful: ${bot.options.username}@${bot.options.apiUrl?.split('/api.php').join('')}`);

	// Load config from the wiki
	await loadConfig();
	
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

	// Load all edit modules
	require('fs').readdirSync(path.resolve('./modules/')).forEach((mPath: string) => {
		if (
			mPath.match(/.*\.(?<!disabled\.)(?:js|ts)/) &&
			!config.disabledModules.includes(path.basename(mPath, path.extname(mPath)))
		) {
			modules.push(require(path.resolve('./modules/' + mPath)));
		}
	});
	mwn.log(`[i] Loaded ${modules.length} modules`);

	// Get all pages
	var pages: { pageid: number, ns: number, title: string }[] = [];

	await Promise.all(config.namespaces.map(async ns => {
		await bot.continuedQuery({
			action: 'query',
			list: 'allpages',
			prop: 'info',
			aplimit: 'max',
			apnamespace: ns
		}).then((results) => {
			results.forEach(result => {
				pages.push(...result.query?.allpages);
			});
		});
	}));
	mwn.log(`[i] Loaded ${pages.length} pages`);

	// Run through each page with a ratelimit
	const scheduleEdit = (i: number) => {
		if (i < pages.length) {
			processPage(pages[i].title);
			i++;
			setTimeout(scheduleEdit, ratelimit, i);
		} else {
			mwn.log('[i] Done');
			process.exit(0);
		}
	}
	scheduleEdit(0);
});

async function processPage(title: string) {
	await bot.edit(title, (rev) => {
		let pageContent = rev.content; // Original content
		let pageEdit = pageContent; // Content to be edited
		let summaryChanges = new Set<string>([]);

		// Run page through each module to stage edits
		modules.forEach((module: any) => {
			let thisModuleEdit: string = module.default(pageEdit, title);
			if (pageEdit != thisModuleEdit) { // A change was made
				pageEdit = thisModuleEdit;
				summaryChanges.add(module.summary);
			}
		});

		// Run page through each replace
		config.replaces.forEach((replace) => {
			let thisModuleEdit = pageEdit.replace(replace.find, replace.replace);
			if (pageEdit != thisModuleEdit) { // A change was made
				pageEdit = thisModuleEdit;
				summaryChanges.add(replace.summary || '[[Project:Bots/config|replaces]]');
			}
		})

		return {
			text: pageEdit,
			summary: `Automated: ${[...summaryChanges].join(', ')}`
		}
	}).then((data) => {
		if (data.result == 'Success' && !data.nochange) {
			mwn.log(`[S] Successfully edited ${data.title} (revision ${data.newrevid})`);
		} else if (data.result == 'Success' && data.nochange) {
			if (logAll) mwn.log(`[/] No change from edit to ${data.title}`);
		}
	}).catch((e: MwnError) => {
		if (e.code == 'bot-denied') mwn.log(`[W] Denied editing ${title}`);
		else {
			mwn.log(`[E] ${e.code} ${e.info || ''}`);
			console.error(e);
		}
	});
}

async function loadConfig(): Promise<void> {
	var configPage: ApiPage = await bot.read('Project:Bots/config');	
	var configData: string = configPage.revisions?.[0].content || '';
	if (configPage.missing || !configData) return mwn.log('[i] No config page');
	mwn.log('[i] Loaded config page');

	function parseConfig(section: string): any[] {
		let regex = new RegExp(`(?<=<!--\\s*${section}\\s*-->).*(?=<!--\\s*${section}-end\\s*-->)`, 's');
		let match = configData.match(regex)?.[0]?.trim();
		
		return match ? JSON.parse(match) : config[section];
	}

	config.approvedBots = parseConfig('approved-bots');
	var replaceMatches = parseConfig('replaces');
	config.namespaces = parseConfig('namespaces');
	config.disabledModules = parseConfig('disabled-modules');

	var replacesArray: ReplaceObject[] = [];

	await Promise.all(replaceMatches.map(async (replace: string | object) => {
		let myReplaces: ReplaceObject[] = [];
		if (typeof replace === 'string') { // Extra JSON page
			if (/https?:\/\/.+/.test(replace)) { // External URL
				try {
					const { body } = await request(replace);
					const data = await body.json();

					if (Array.isArray(data)) myReplaces = data;
					else return mwn.log('[W] No valid JSON in external replaces URL: ' + replace);
				} catch (e) {
					return mwn.log('[E] Error while fetching external replaces URL: ' + replace);
				}
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
				item.find = new RegExp(item.find, 'gm');
			} else { // Invalid, remove the item
				myReplaces.splice(i, 1);
			}
		}));
		replacesArray = replacesArray.concat(myReplaces);
	}));

	if (!replacesArray) mwn.log('[i] No replaces loaded');
	else mwn.log(`[i] Loaded ${replacesArray.length} replaces`);

	config.replaces = replacesArray;
}

interface ReplaceObject extends Object {
	summary?: string;
	find: string | RegExp;
	replace: string;
}
