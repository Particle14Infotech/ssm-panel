const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.controller.ts')) {
      results.push(file);
    }
  });
  return results;
}

const controllers = walk('apps/api/src/modules');
const endpoints = [];

controllers.forEach(ctrlPath => {
  const content = fs.readFileSync(ctrlPath, 'utf8');
  const controllerMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
  const baseRoute = controllerMatch ? controllerMatch[1] : '';
  const classGuardsMatch = content.match(/@UseGuards\(([^)]+)\)\s*export\s+class/);
  const classGuards = classGuardsMatch ? classGuardsMatch[1].trim() : '';

  const lines = content.split('\n');
  let currentMethodGuards = '';
  let currentRoles = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('@UseGuards(')) {
      currentMethodGuards = line.replace(/@UseGuards\(/, '').replace(/\)/, '');
    }
    if (line.startsWith('@Roles(')) {
      currentRoles = line.replace(/@Roles\(/, '').replace(/\)/, '');
    }
    const methodMatch = line.match(/@(Get|Post|Put|Delete|Patch)\((?:['"]([^'"]*)['"])?\)/);
    if (methodMatch) {
      const httpMethod = methodMatch[1].toUpperCase();
      const subRoute = methodMatch[2] || '';
      const fullPath = ('/' + baseRoute + (subRoute ? '/' + subRoute : '')).replace(/\/+/g, '/');
      endpoints.push({
        controller: path.basename(ctrlPath),
        httpMethod,
        path: fullPath,
        classGuards,
        methodGuards: currentMethodGuards,
        roles: currentRoles
      });
      currentMethodGuards = '';
      currentRoles = '';
    }
  }
});

console.log(JSON.stringify(endpoints, null, 2));
