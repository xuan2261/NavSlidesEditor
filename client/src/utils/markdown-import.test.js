import { describe, it, expect } from 'vitest';
import { markdownToSlides } from './markdown-import.js';

describe('markdownToSlides', () => {
  it('should split markdown by --- into multiple slides', () => {
    const md = `Slide 1\n---\nSlide 2`;
    const slides = markdownToSlides(md);
    expect(slides.length).toBe(2);
    expect(slides[0].elements[0].content).toContain('Slide 1');
    expect(slides[1].elements[0].content).toContain('Slide 2');
  });

  it('should split by ## headings when --- is not present', () => {
    const md = `## Heading 1\nContent 1\n## Heading 2\nContent 2`;
    const slides = markdownToSlides(md);
    expect(slides.length).toBe(2);
    expect(slides[0].elements[0].content).toContain('Heading 1');
    expect(slides[0].elements[0].content).toContain('Content 1');
    expect(slides[1].elements[0].content).toContain('Heading 2');
    expect(slides[1].elements[0].content).toContain('Content 2');
  });

  it('should format title slides correctly', () => {
    const md = `# Main Title`;
    const slides = markdownToSlides(md);
    const element = slides[0].elements[0];
    // Since it's a title slide, width should be 800, y should be 180
    expect(element.width).toBe(800);
    expect(element.y).toBe(180);
    expect(element.content).toContain('Main Title');
  });

  it('should generate valid UUIDs for slide and element IDs', () => {
    const md = `Content`;
    const slides = markdownToSlides(md);
    expect(slides[0].id).toBeDefined();
    expect(slides[0].elements[0].id).toBeDefined();
  });
});
