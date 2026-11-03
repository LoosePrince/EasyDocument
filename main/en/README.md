# EasyDocument

EasyDocument is a static documentation system with **content stored in a separate git branch**. Every page is prerendered at build time, so real-path URLs work without a hash router.

## Highlights

- **Content and code are separated**: code lives on `main`, docs and `config.js` live on the content branch (`data` by default).
- **Real paths + prerendering**: `/docs-en/main` is a real static page, ready for sharing and search engines.
- **Edit in the browser**: open any document, click “Edit this page”, save a local draft, then commit all at once.
- **Full-site i18n**: switch the interface language, and organize docs with language folders (`main/en/...`) or suffixes (`README.en.md`).
- **Configurable icons**: navigation, home cards, folders and documents can use the icon library or an icon URL.
- **Visual ordering**: drag, move up/down, and move items between folders in the console.

## Language fallback

This page is a translated example. Documents without an English translation fall back to the default language and show a short notice.

> [TIP] Switch languages from the globe button in the header. The URL becomes `/docs-en/main/...` for English.
