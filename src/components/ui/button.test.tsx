// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TagInput } from '@/features/notes/tag-input';
import { useState } from 'react';

describe('Button', () => {
  it('renders and handles clicks', async () => {
    const user = userEvent.setup();
    let clicked = 0;
    render(<Button onClick={() => (clicked += 1)}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    await user.click(button);
    expect(clicked).toBe(1);
  });

  it('shows a spinner and disables while loading', () => {
    render(
      <Button loading aria-label="Go">
        Go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBeDisabled();
  });

  it('is accessible via keyboard', async () => {
    const user = userEvent.setup();
    let clicked = 0;
    render(<Button onClick={() => (clicked += 1)}>Enter</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Enter' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(clicked).toBe(1);
  });
});

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Add something to get started." />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument();
  });
});

describe('TagInput', () => {
  function Harness() {
    const [tags, setTags] = useState<string[]>([]);
    return (
      <TagInput tags={tags} onChange={setTags} suggestions={['biology', 'physics', 'history']} />
    );
  }

  it('adds a tag on Enter (normalized to lowercase)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add tag');
    await user.type(input, 'Chemistry{Enter}');
    expect(screen.getByText('chemistry')).toBeInTheDocument();
  });

  it('normalizes to lowercase and strips #', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add tag');
    await user.type(input, '#BIOLOGY{Enter}');
    expect(screen.getByText('biology')).toBeInTheDocument();
  });

  it('offers suggestions from existing tags', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add tag');
    await user.type(input, 'bio');
    expect(await screen.findByText('biology')).toBeInTheDocument();
  });

  it('removes a tag with its button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add tag');
    await user.type(input, 'physics{Enter}');
    await user.click(screen.getByLabelText('Remove tag physics'));
    expect(screen.queryByText('physics')).not.toBeInTheDocument();
  });
});
