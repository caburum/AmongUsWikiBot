export default function(text: string) {
	let matches: string[] = text.match(/\[\[w:c:\S+:.*?(?:\|.*?]]|]])/gmi) || [];

	matches.forEach((match) => {
		let link = match.replace('[[w:c:', '').replace(']]', ''); // Trim wrapper

		let [interwiki, name] = link.split(/\|(.*)/);
		let [wiki, page] = interwiki.split(/:(.*)/);
		if (page == name) { name = '' }
		if (wiki == 'henrystickmin') { wiki = 'hs' }
		let template = `{{Iw|${wiki}${page ? '|' + page : (name ? '|' : '')}${name ? '|' + name : ''}}}`;

		text = text.replace(match, template);
	})

	return text;
}

export let summary = 'converting interwiki to {{Iw}}';