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

  it('should parse slide background config from HTML comments', () => {
    const md = `<!-- .slide: data-background-color="#ff0000" -->\n# Title`;
    const slides = markdownToSlides(md);
    expect(slides[0].background).toBeDefined();
    expect(slides[0].background.type).toBe('color');
    expect(slides[0].background.color).toBe('#ff0000');
  });

  it('should parse slide background image from HTML comments', () => {
    const md = `<!-- .slide: data-background-image="https://example.com/img.jpg" -->\n# Title`;
    const slides = markdownToSlides(md);
    expect(slides[0].background).toBeDefined();
    expect(slides[0].background.type).toBe('image');
    expect(slides[0].background.image).toBe('https://example.com/img.jpg');
  });
});
