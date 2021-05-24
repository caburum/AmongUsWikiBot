export default function(text: string) {
	return text
		// Plural
		.replace(/\[\[[Mm]aps\|map]]/g, '[[map]]')
		.replace(/\[\[[Mm]aps\|Map]]/g, '[[Map]]')
		.replace(/\[\[[Tt]asks\|task]]/g, '[[task]]')
		.replace(/\[\[[Tt]asks\|Task]]/g, '[[Task]]')
		.replace(/\[\[[Rr]oles\|role]]/g, '[[role]]')
		.replace(/\[\[[Rr]oles\|Role]]/g, '[[Role]]')
		.replace(/\[\[[Cc]olors\|color]]/g, '[[color]]')
		.replace(/\[\[[Cc]olors\|Color]]/g, '[[Color]]')
		.replace(/\[\[[Aa]bilities\|ability]]/g, '[[ability]]')
		.replace(/\[\[[Aa]bilities\|Ability]]/g, '[[Ability]]')
		.replace(/\[\[[Ll]ocations\|location]]/g, '[[location]]')
		.replace(/\[\[[Ll]ocations\|Location]]/g, '[[Location]]')
		.replace(/\[\[[Vv]isual tasks\|visual task]]/g, '[[visual task]]')
		.replace(/\[\[[Vv]isual tasks\|Visual task]]/g, '[[Visual task]]')
		.replace(/\[\[[Ss]kins\|skin]]/g, '[[skin]]')
		.replace(/\[\[[Ss]kins\|Skin]]/g, '[[Skin]]')
		.replace(/\[\[[Hh]ats\|hat]]/g, '[[hat]]')
		.replace(/\[\[[Hh]ats\|Hat]]/g, '[[Hat]]')
		.replace(/\[\[[Pp]ets\|pet]]/g, '[[pet]]')
		.replace(/\[\[[Pp]ets\|Pet]]/g, '[[Pet]]')
		// Alternate names
		.replace(/\[\[Upload Data\|Download Data]]/g, '[[Download Data]]')
		.replace(/\[\[Divert Power\|Accept Diverted Power]]/g, '[[Accept Diverted Power]]')
}

export let summary = 'fixing links';