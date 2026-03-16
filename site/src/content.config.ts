import { defineCollection, z } from 'astro:content';

// 文章内容集合 - 按主题分目录存放

const image = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const threeD = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const video = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const virtualHuman = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const audio = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const comfyui = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

const presentations = defineCollection({
  type: 'content',
  schema: z.object({}).passthrough().optional(),
});

export const collections = {
  image,
  '3d': threeD,
  video,
  'virtual-human': virtualHuman,
  audio,
  comfyui,
  presentations,
};
