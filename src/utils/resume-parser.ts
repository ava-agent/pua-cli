/**
 * 简历解析工具
 * 从 PDF 文件中提取文本并解析候选人信息
 */

import fs from 'fs';
import path from 'path';
import type { CandidateProfile } from '../prompts/interview-prompts';

/**
 * 从 PDF 文件解析简历文本
 */
export async function parseResumePDF(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext !== '.pdf') {
    throw new Error(`不支持的文件格式: ${ext}（仅支持 .pdf）`);
  }

  const stat = fs.statSync(resolved);
  if (stat.size > 5 * 1024 * 1024) {
    throw new Error('文件太大（最大 5MB）');
  }

  // pdf-parse v2 uses PDFParse class with data in constructor
  const { PDFParse } = await import('pdf-parse');
  const buffer = fs.readFileSync(resolved);
  const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
  const textResult = await parser.getText();

  const text = textResult.pages.map((p: { text: string }) => p.text).join('\n');

  if (!text || text.trim().length === 0) {
    throw new Error('无法从 PDF 中提取文本（可能是扫描件）');
  }

  await parser.destroy();
  return text.trim();
}

/**
 * 从简历文本中提取候选人信息
 * 使用简单的关键词匹配（不依赖 AI）
 */
export function extractProfileFromResume(text: string): CandidateProfile {
  const profile: CandidateProfile = {
    resumeText: text.slice(0, 1000), // 保留前1000字作为摘要
  };

  // 提取姓名（通常在开头几行）
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // 简历第一行通常是名字（2-4个汉字，或英文名）
    if (/^[\u4e00-\u9fa5]{2,4}$/.test(firstLine) || /^[A-Za-z\s]{2,30}$/.test(firstLine)) {
      profile.name = firstLine;
    }
  }

  // 提取工作年限
  const expMatch = text.match(/(\d{1,2})\s*[年年]\s*(?:工作|开发|从业|项目)/);
  if (expMatch) {
    profile.experience = parseInt(expMatch[1]);
  }

  // 提取技术栈
  const techKeywords = [
    'React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Node.js',
    'Python', 'Java', 'Go', 'Rust', 'C++', 'PHP', 'Ruby', 'Swift',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
    'AWS', 'Azure', 'Linux', 'Git', 'Webpack', 'Vite', 'Next.js',
    'Spring', 'Django', 'Flask', 'Express', 'GraphQL', 'REST',
    'Figma', 'Sketch', 'Photoshop', 'Axure',
  ];
  const foundTech = techKeywords.filter(kw =>
    text.toLowerCase().includes(kw.toLowerCase())
  );
  if (foundTech.length > 0) {
    profile.techStack = foundTech.slice(0, 10).join(', ');
  }

  // 提取期望薪资
  const salaryMatch = text.match(/(?:期望|目标|薪资|月薪|年薪)[：:]\s*(.{3,20})/);
  if (salaryMatch) {
    profile.targetSalary = salaryMatch[1].trim();
  }

  // 提取教育背景
  const eduKeywords = ['本科', '硕士', '博士', '985', '211', 'Bachelor', 'Master', 'PhD'];
  const eduMatch = text.match(new RegExp(`(${eduKeywords.join('|')}).{0,30}`, 'i'));
  if (eduMatch) {
    profile.background = eduMatch[0].trim();
  }

  return profile;
}
