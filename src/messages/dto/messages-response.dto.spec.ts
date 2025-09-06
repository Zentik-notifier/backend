import { Message } from '../../entities/message.entity';
import { MessagesResponseDto } from './messages-response.dto';

describe('MessagesResponseDto', () => {
  let dto: MessagesResponseDto;
  let mockMessages: Partial<Message>[];

  beforeEach(() => {
    dto = new MessagesResponseDto();
    mockMessages = [
      { id: '1', title: 'Test Message 1' } as Partial<Message>,
      { id: '2', title: 'Test Message 2' } as Partial<Message>,
    ];
  });

  describe('properties', () => {
    it('should have messages property', () => {
      dto.messages = mockMessages as Message[];
      expect(dto.messages).toEqual(mockMessages);
    });

    it('should have total property', () => {
      dto.total = 100;
      expect(dto.total).toBe(100);
    });

    it('should have page property', () => {
      dto.page = 3;
      expect(dto.page).toBe(3);
    });

    it('should have limit property', () => {
      dto.limit = 25;
      expect(dto.limit).toBe(25);
    });
  });

  describe('computed properties', () => {
    it('should calculate totalPages correctly', () => {
      dto.total = 100;
      dto.limit = 20;
      expect(dto.totalPages).toBe(5);
    });

    it('should calculate totalPages with remainder correctly', () => {
      dto.total = 105;
      dto.limit = 20;
      expect(dto.totalPages).toBe(6);
    });

    it('should return 0 totalPages when total is 0', () => {
      dto.total = 0;
      dto.limit = 20;
      expect(dto.totalPages).toBe(0);
    });

    it('should calculate hasNextPage correctly when there are more pages', () => {
      dto.total = 100;
      dto.limit = 20;
      dto.page = 1;
      expect(dto.hasNextPage).toBe(true);
    });

    it('should calculate hasNextPage correctly when on last page', () => {
      dto.total = 100;
      dto.limit = 20;
      dto.page = 5;
      expect(dto.hasNextPage).toBe(false);
    });

    it('should calculate hasNextPage correctly when no results', () => {
      dto.total = 0;
      dto.limit = 20;
      dto.page = 1;
      expect(dto.hasNextPage).toBe(false);
    });

    it('should calculate hasPreviousPage correctly when there are previous pages', () => {
      dto.page = 3;
      expect(dto.hasPreviousPage).toBe(true);
    });

    it('should calculate hasPreviousPage correctly when on first page', () => {
      dto.page = 1;
      expect(dto.hasPreviousPage).toBe(false);
    });

    it('should calculate hasPreviousPage correctly when page is 0', () => {
      dto.page = 0;
      expect(dto.hasPreviousPage).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero limit gracefully', () => {
      dto.total = 100;
      dto.limit = 0;
      expect(dto.totalPages).toBe(Infinity);
    });

    it('should handle negative limit gracefully', () => {
      dto.total = 100;
      dto.limit = -10;
      expect(dto.totalPages).toBe(-10);
    });

    it('should handle negative page gracefully', () => {
      dto.page = -1;
      expect(dto.hasPreviousPage).toBe(false);
    });
  });
});
