import { IsAttachmentsEnabled } from './attachments-enabled.decorator';

describe('IsAttachmentsEnabled', () => {
  it('should be defined', () => {
    expect(IsAttachmentsEnabled).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof IsAttachmentsEnabled).toBe('function');
  });

  it('should return a function when called', () => {
    const decorator = IsAttachmentsEnabled();
    expect(typeof decorator).toBe('function');
  });

  it('should accept validation options', () => {
    const decorator = IsAttachmentsEnabled({ message: 'Custom message' });
    expect(typeof decorator).toBe('function');
  });
});
