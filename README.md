# Door Man

A tiny browser game made from P's artwork.

## Play on this Mac

Open `index.html` in a browser, or run a small web server from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Play on an iPad

Keep the server running on the Mac, make sure the iPad is on the same Wi-Fi, then open:

```text
http://YOUR-MAC-IP:8080
```

The game has touch buttons, five hearts in the upper-right corner, punching bad guys, a gun bad guy who shoots every three seconds, and a boss fight after seven bad guys.

## Make It More Durable

This is now an installable web app with an offline cache. After it loads once on the iPad, Safari can keep the game files cached.

For the most durable setup, host this folder as a static website with GitHub Pages, Netlify, Cloudflare Pages, or another static host. Then the iPad can use a real URL and it will not depend on this Mac's temporary local server.
