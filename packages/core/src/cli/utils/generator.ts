import Handlebars from 'handlebars';
import fs from 'fs-extra';
import { join } from 'path';

export async function generateFile(
  templatePath: string,
  outputPath: string,
  data: Record<string, unknown>
): Promise<void> {
  const output = await renderTemplate(templatePath, data);
  await fs.ensureDir(join(outputPath, '..'));
  await fs.writeFile(outputPath, output, 'utf-8');
}

export async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>
): Promise<string> {
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  console.log(data, 'template data')
  return template(data);
}

export async function appendToFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.appendFile(filePath, content, 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.ensureDir(join(filePath, '..'));
  await fs.writeFile(filePath, content, 'utf-8');
}
