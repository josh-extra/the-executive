export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const FEEDS = {
    asx: [
      { url: "https://www.fool.com.au/feed/", name: "Motley Fool AU" },
      { url: "https://stockhead.com.au/feed/", name: "Stockhead" },
      { url: "https://raskmedia.com.au/feed/", name: "Rask Media" },
    ],
    us: [
      { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US", name: "Yahoo Finance S&P" },
      { url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_tag=business", name: "Reuters Business" },
    ],
    crypto: [
      { url: "https://cointelegraph.com/rss", name: "CoinTelegraph" },
      { url: "https://decrypt.co/feed", name: "Decrypt" },
    ],
    macro: [
      { url: "https://www.abc.net.au/news/feed/51120/rss.xml", name: "ABC Business" },
      { url: "https://www.smh.com.au/rssheadlines/business/article/rss.xml", name: "SMH Business" },
    ]
  };

  const parseRSS = (xml, sourceName) => {
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const item = match[1];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        || item.match(/<title>(.*?)<\/title>/)?.[1]
        || "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1]
        || item.match(/<link[^>]*href="([^"]*)"[^>]*\/>/)?.[1]
        || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s)?.[1]
        || item.match(/<description>(.*?)<\/description>/s)?.[1]
        || "").replace(/<[^>]*>/g, "").trim().slice(0, 200);
      if (title) items.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim(),
        link: link.trim(),
        pubDate,
        description,
        source: sourceName,
        timestamp: pubDate ? new Date(pubDate).getTime() : 0
      });
    }
    return items;
  };

  const fetchFeed = async (url, name) => {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TheExecutive/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*"
        },
        signal: AbortSignal.timeout(5000)
      });
      const xml = await r.text();
      return parseRSS(xml, name);
    } catch { return []; }
  };

  try {
    const results = {};
    await Promise.all(
      Object.entries(FEEDS).map(async ([category, feeds]) => {
        const all = (await Promise.all(feeds.map(f => fetchFeed(f.url, f.name)))).flat();
        results[category] = all
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 8);
      })
    );
    res.setHeader("Cache-Control", "public, max-age=300"); // cache 5 mins
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}