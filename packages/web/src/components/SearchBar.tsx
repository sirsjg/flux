// import { h } removed from 'preact';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: SearchBarProps) {
  return (
    <div className="search-group">
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      />
      <button className="btn-icon" type="button">
        <MagnifyingGlassIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
