# Contabo Deployment

## Rotate

`Rotate` veut dire:

- regenerer une cle ou un mot de passe
- invalider l'ancien
- remplacer partout par la nouvelle valeur

On le fait quand un secret a ete expose, partage, ou douteux.

## Pourquoi `.env.production` et `.env.production.local` sont ignores par git

Le repo contient dans `.gitignore`:

```gitignore
.env*
```

Donc ces fichiers:

- restent dans ton repo local
- servent au deploiement
- ne partent pas dans l'historique git
- ne sont pas envoyes au remote au `push`

Le but est simple: eviter de publier des secrets dans GitHub ou dans l'historique du projet.

## Fichiers crees

- `deploy/contabo/nginx/app.horion.tech.conf`
- `deploy/contabo/nginx/staging.horion.tech.conf`
- `deploy/contabo/pm2/ecosystem.config.cjs`
- `deploy/contabo/cron/horion.crontab`

## Arborescence serveur recommandee

- `/opt/horion/prod`
- `/opt/horion/staging`

Chaque dossier contient:

- le repo
- son propre build
- son propre fichier `.env.production`

## Nginx

Copier les fichiers:

```bash
sudo cp deploy/contabo/nginx/app.horion.tech.conf /etc/nginx/sites-available/app.horion.tech
sudo cp deploy/contabo/nginx/staging.horion.tech.conf /etc/nginx/sites-available/staging.horion.tech
sudo ln -s /etc/nginx/sites-available/app.horion.tech /etc/nginx/sites-enabled/app.horion.tech
sudo ln -s /etc/nginx/sites-available/staging.horion.tech /etc/nginx/sites-enabled/staging.horion.tech
sudo nginx -t
sudo systemctl reload nginx
```

Puis activer HTTPS:

```bash
sudo certbot --nginx -d app.horion.tech
sudo certbot --nginx -d staging.horion.tech
```

## PM2

Creer le dossier de logs:

```bash
sudo mkdir -p /var/log/horion/pm2
sudo chown -R $USER:$USER /var/log/horion
```

Lancer PM2:

```bash
pm2 start deploy/contabo/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

## Crons

Creer le dossier de logs cron:

```bash
sudo mkdir -p /var/log/horion-crons
sudo chown -R $USER:$USER /var/log/horion-crons
```

Installer les crons:

```bash
cp deploy/contabo/cron/horion.crontab /tmp/horion.crontab
nano /tmp/horion.crontab
crontab /tmp/horion.crontab
crontab -l
```

Important:

- remplacer `CHANGE_ME_CRON_SECRET`
- verifier `HORION_DOMAIN=https://app.horion.tech`

## Build et lancement

Dans chaque dossier:

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
```

Ensuite PM2 sert:

- prod sur `3000`
- staging sur `3001`

## Supabase

Le repo est maintenant configure pour:

- `DATABASE_URL` = pooler Supabase
- `DIRECT_URL` = connexion directe

Pour la vraie mise en prod:

- rotate les secrets exposes
- remplace les placeholders `CHANGE_ME_BEFORE_DEPLOY`
- ajoute le token `PAWAPAY`
- ajoute les secrets WhatsApp/Resend si utilises
