import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const ontologyDir = join(rootDir, 'ontologies');
const publicDir = join(rootDir, 'public');
const rootsOutputPath = join(publicDir, 'ontology-roots.json');
const childrenOutputDir = join(publicDir, 'ontology-children');
const legacyIndexPath = join(publicDir, 'ontology-index.json');

const LABEL_DATATYPE_PRIORITY = ['xsd:string', '@en', '@en-us'];

/**
 * Execute a SQLite query and parse json output.
 * @param {string} dbPath
 * @param {string} query
 * @returns {Array<Record<string, string>>}
 */
function queryJson(dbPath, query) {
  const raw = execFileSync('sqlite3', ['-json', dbPath, query], { encoding: 'utf8' }).trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

const escapeSqlText = (value) => value.replace(/'/g, "''");

/**
 * Build ontology classes from one sqlite db.
 * @param {string} dbPath
 */
function buildOntologyFromDb(dbPath) {
  const fileName = basename(dbPath);
  const ontologyId = fileName.replace(/\.db$/i, '').toLowerCase();
  const ontologyCode = ontologyId.toUpperCase();
  const subjectPrefix = `obo:${ontologyCode}_`;
  const sqlSafePrefix = escapeSqlText(subjectPrefix);

  const namedClassRows = queryJson(
    dbPath,
    `
      SELECT DISTINCT subject AS iri
      FROM statement
      WHERE predicate = 'rdf:type'
        AND object = 'owl:Class'
        AND datatype = '_IRI'
        AND subject LIKE '${sqlSafePrefix}%';
    `,
  );
  const namedClassIris = new Set(namedClassRows.map((row) => row.iri));

  if (namedClassIris.size === 0) {
    return {
      id: ontologyId,
      name: ontologyCode,
      sourceDb: fileName,
      classPrefix: subjectPrefix,
      roots: [],
      childrenByParent: new Map(),
    };
  }

  const rawLabels = queryJson(
    dbPath,
    `
      SELECT subject AS iri, object AS label, datatype
      FROM statement
      WHERE predicate = 'rdfs:label'
        AND subject LIKE '${sqlSafePrefix}%';
    `,
  );
  const labelByIri = new Map();
  rawLabels.forEach((row) => {
    if (!namedClassIris.has(row.iri)) return;
    const current = labelByIri.get(row.iri);
    const currentPriority = current ? LABEL_DATATYPE_PRIORITY.indexOf(current.datatype) : Number.POSITIVE_INFINITY;
    const nextPriority = LABEL_DATATYPE_PRIORITY.indexOf(row.datatype);
    const normalizedNextPriority = nextPriority === -1 ? Number.POSITIVE_INFINITY : nextPriority;
    if (!current || normalizedNextPriority < currentPriority) {
      labelByIri.set(row.iri, { label: row.label, datatype: row.datatype });
    }
  });

  const subclasses = queryJson(
    dbPath,
    `
      SELECT subject AS child, object AS parent
      FROM statement
      WHERE predicate = 'rdfs:subClassOf'
        AND datatype = '_IRI'
        AND subject LIKE '${sqlSafePrefix}%'
        AND object LIKE '${sqlSafePrefix}%';
    `,
  );

  const parentIrisByChild = new Map();
  const childIrisByParent = new Map();

  subclasses.forEach((row) => {
    if (!namedClassIris.has(row.child) || !namedClassIris.has(row.parent)) return;

    if (!parentIrisByChild.has(row.child)) {
      parentIrisByChild.set(row.child, new Set());
    }
    parentIrisByChild.get(row.child).add(row.parent);

    if (!childIrisByParent.has(row.parent)) {
      childIrisByParent.set(row.parent, new Set());
    }
    childIrisByParent.get(row.parent).add(row.child);
  });

  const nodeForIri = (iri) => ({
    iri,
    label: labelByIri.get(iri)?.label || iri,
    hasChildren: childIrisByParent.has(iri),
    childrenKey: toNodeKey(iri),
  });

  const roots = Array.from(namedClassIris)
    .filter((iri) => !parentIrisByChild.has(iri) || parentIrisByChild.get(iri).size === 0)
    .map(nodeForIri)
    .sort((a, b) => a.label.localeCompare(b.label));

  const childrenByParent = new Map();
  childIrisByParent.forEach((childSet, parentIri) => {
    const children = Array.from(childSet)
      .map(nodeForIri)
      .sort((a, b) => a.label.localeCompare(b.label));
    childrenByParent.set(parentIri, children);
  });

  return {
    id: ontologyId,
    name: ontologyCode,
    sourceDb: fileName,
    classPrefix: subjectPrefix,
    roots,
    childrenByParent,
  };
}

const toNodeKey = (iri) => createHash('sha1').update(iri).digest('hex');
const toChildFileName = (iri) => `${toNodeKey(iri)}.json`;

function main() {
  const dbFiles = readdirSync(ontologyDir)
    .filter((entry) => entry.toLowerCase().endsWith('.db'))
    .sort((a, b) => a.localeCompare(b));

  const ontologyBuilds = dbFiles.map((fileName) =>
    buildOntologyFromDb(join(ontologyDir, fileName)),
  );
  const ontologies = ontologyBuilds.map((ontology) => ({
    id: ontology.id,
    name: ontology.name,
    sourceDb: ontology.sourceDb,
    classPrefix: ontology.classPrefix,
    roots: ontology.roots,
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    ontologies,
  };

  mkdirSync(publicDir, { recursive: true });
  rmSync(childrenOutputDir, { recursive: true, force: true });
  mkdirSync(childrenOutputDir, { recursive: true });

  ontologyBuilds.forEach((ontology) => {
    const ontologyChildDir = join(childrenOutputDir, ontology.id);
    mkdirSync(ontologyChildDir, { recursive: true });
    ontology.childrenByParent.forEach((children, parentIri) => {
      const childPayload = {
        ontologyId: ontology.id,
        parentIri,
        children,
      };
      writeFileSync(
        join(ontologyChildDir, toChildFileName(parentIri)),
        `${JSON.stringify(childPayload, null, 2)}\n`,
        'utf8',
      );
    });
  });

  rmSync(legacyIndexPath, { force: true });
  writeFileSync(rootsOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(
    `Generated ${rootsOutputPath} and ${childrenOutputDir} for ${ontologies.length} ontology(ies) from ${dbFiles.length} DB file(s).`,
  );
}

main();
