// Sets the Windows .exe icon + version info with pure-JS resedit (no Wine needed on Linux build hosts).
const path = require('path');
const fs = require('fs');
exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const PELibrary = await import('pe-library');
  const R = ResEdit.default || ResEdit, PE = PELibrary.default || PELibrary;
  const name = context.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(context.appOutDir, name);
  const exe = PE.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);
  const iconFile = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, iconFile.icons.map(i => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0] || R.Resource.VersionInfo.createEmpty();
  const v = context.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
  vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Daedalus Robot Vision Lab', ProductName: 'Daedalus Robot Vision Lab',
    CompanyName: 'Daedalus Lab', LegalCopyright: '© 2026 Daedalus Lab', OriginalFilename: name, InternalName: 'Daedalus'
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • afterPack: icon + version info written to', name);
};
