import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const htaccess = `Options -MultiViews
RewriteEngine On

# Allow direct file/directory access
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Route /api/* to PHP API router
RewriteRule ^api(/.*)?$ api/index.php [QSA,L]

# Route everything else to React SPA
RewriteRule ^ index.html [QSA,L]
`;

writeFileSync(join(__dirname, '../dist/.htaccess'), htaccess);
console.log('✓ .htaccess written to dist/');
