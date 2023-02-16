### One redirect

Support redirect `xx.1` to `xx.1.country` even tho the browser does not recognized `.1` domain.

#### Build

```
npm install
npm run prebuild
npm run init:profile
npm run build:<browser_name> # brave | chrome | firefox | safari | chromev2
npm run start:<browser_name> # brave | chrome | firefox
npm run test-server # open a local server with examples showcase how `.1` links will be redirected
```