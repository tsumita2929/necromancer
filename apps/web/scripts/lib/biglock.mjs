// A generated package-lock.json with many packages, for the "very large lockfile" checks.
export function bigLockfile(count = 320) {
  const packages = { '': { name: 'big', version: '1.0.0', dependencies: {} } };
  const dependencies = {};
  for (let i = 0; i < count; i += 1) {
    const name = `fixture-package-${String(i).padStart(3, '0')}`;
    packages[`node_modules/${name}`] = { version: '1.0.0' };
    dependencies[name] = '^1.0.0';
  }
  packages[''].dependencies = dependencies;
  return JSON.stringify({ name: 'big', version: '1.0.0', lockfileVersion: 3, packages });
}
