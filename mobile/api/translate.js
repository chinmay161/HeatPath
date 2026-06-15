// Free translation via MyMemory - no API key required for demo-level usage
export async function translateText(text, sourceLang, targetLang) {
  if (targetLang === undefined) targetLang = 'en';
  if (!text || sourceLang === targetLang) return text;

  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + sourceLang + '|' + targetLang;
    const response = await fetch(url);
    if (!response.ok) return text;

    const data = await response.json();
    const translated = data && data.responseData && data.responseData.translatedText;

    if (!translated || translated.toUpperCase().includes('QUERY LENGTH LIMIT')) {
      return text;
    }
    return translated;
  } catch {
    return text;
  }
}
