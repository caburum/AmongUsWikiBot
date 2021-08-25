export default function(text: string, pageTitle: string) {
	let galleries: string[] = text.match(/<gallery .*>/gmi) || [];

	galleries.forEach((gallery: string) => {
		let newGallery = gallery.replace(/ ?(captiontextcolor|bordercolor|bordersize|hideaddbutton)=[^\s>]+/gim, '');
		text = text.replace(gallery, newGallery);
	});
	
	let galleryContents: string[] = text.match(/<gallery(?: .*?)?>.*?<\/gallery>/gs) || [];

	galleryContents.forEach((gallery: string) => {
		let newGallery = gallery.replace(/^File:/gm, '');
		text = text.replace(gallery, newGallery);
	});

	return text;
}

export let summary = 'cleaning up galleries';
