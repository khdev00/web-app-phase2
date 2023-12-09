import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {

  test('renders all buttons', () => {
    render(<App />);    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(11);
});
   



  //call render(<App />) for each test
});
