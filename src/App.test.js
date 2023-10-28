import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {

  test('renders all buttons', () => {
    render(<App />);

           
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);

    expect(screen.getByRole('button', { name: 'Download Packages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grade Packages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Registry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Registry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Registry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Package' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Package' })).toBeInTheDocument();
});

  //call render(<App />) for each test
});
