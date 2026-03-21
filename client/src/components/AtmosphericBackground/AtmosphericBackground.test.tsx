import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AtmosphericBackground } from './AtmosphericBackground';

describe('AtmosphericBackground', () => {
  it('renders a .sun element for sunny theme', () => {
    const { container } = render(<AtmosphericBackground theme="sunny" />);
    expect(container.querySelector('.sun')).toBeInTheDocument();
  });

  it('renders .cloud elements for cloudy theme', () => {
    const { container } = render(<AtmosphericBackground theme="cloudy" />);
    expect(container.querySelectorAll('.cloud').length).toBeGreaterThanOrEqual(2);
  });

  it('renders .raindrop elements for rainy theme', () => {
    const { container } = render(<AtmosphericBackground theme="rainy" />);
    expect(container.querySelectorAll('.raindrop').length).toBeGreaterThan(0);
  });

  it('renders .bolt element for stormy theme', () => {
    const { container } = render(<AtmosphericBackground theme="stormy" />);
    expect(container.querySelector('.bolt')).toBeInTheDocument();
  });

  it('renders no decorative elements for neutral theme', () => {
    const { container } = render(<AtmosphericBackground theme="neutral" />);
    expect(container.querySelector('.sun')).toBeNull();
    expect(container.querySelector('.cloud')).toBeNull();
    expect(container.querySelector('.raindrop')).toBeNull();
    expect(container.querySelector('.bolt')).toBeNull();
  });
});
