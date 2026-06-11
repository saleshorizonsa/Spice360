import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const htaccess = `Options -MultiViews
RewriteEngine On

# Do not cache index.html so browsers always fetch the latest version
<Files "index.html">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "0"
</Files>

# Allow direct file/directory access
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Route everything else to React SPA
RewriteRule ^ index.html [QSA,L]
`;

writeFileSync(join(__dirname, '../dist/.htaccess'), htaccess);
console.log('✓ .htaccess written to dist/');
