export default function(text: string) {
	// Fandom interwiki
	let fandomMatches: string[] = text.match(/\[\[w:c:\S+:.*?(?:\|.*?]]|]])/gmi) || [];

	fandomMatches.forEach((match) => {
		let link = match.replace('[[w:c:', '').replace(']]', ''); // Trim wrapper

		let [interwiki, name] = link.split(/\|(.*)/);
		let [wiki, page] = interwiki.split(/:(.*)/);
		if (page == name) { name = '' }
		if (wiki == 'henrystickmin') { wiki = 'hs' }
		let template = `{{Iw|${wiki}${page ? '|' + page : (name ? '|' : '')}${name ? '|' + name : ''}}}`;

		text = text.replace(match, template);
	})

	// Generic interwiki
	let matches: string[] = text.match(/\[\[(?:wikipedia|wp):.*?(?:\|.*?]]|]])/gmi) || [];

	matches.forEach((match) => {
		let link = match.replace('[[', '').replace(']]', ''); // Trim wrapper

		let [interwiki, name] = link.split(/\|(.*)/);
		let [wiki, page] = interwiki.split(/:(.*)/);
		if (page == name) { name = '' }
		if (wiki == 'wikipedia') { wiki = 'wp' }
		let template = `{{Iw|${wiki}${page ? '|' + page : (name ? '|' : '')}${name ? '|' + name : ''}}}`;

		text = text.replace(match, template);
	});

	return text;
}

export let summary = 'converting interwiki to {{Iw}}';