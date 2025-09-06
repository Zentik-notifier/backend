import { validate } from 'class-validator';
import { MessagesQueryDto } from './messages-query.dto';

describe('MessagesQueryDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new MessagesQueryDto();
      dto.page = 1;
      dto.limit = 20;
      dto.search = 'test search';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with default values', async () => {
      const dto = new MessagesQueryDto();

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only page', async () => {
      const dto = new MessagesQueryDto();
      dto.page = 5;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only limit', async () => {
      const dto = new MessagesQueryDto();
      dto.limit = 50;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only search', async () => {
      const dto = new MessagesQueryDto();
      dto.search = 'search term';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid page (zero)', async () => {
      const dto = new MessagesQueryDto();
      dto.page = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints?.isPositive).toBeDefined();
    });

    it('should fail validation with invalid page (negative)', async () => {
      const dto = new MessagesQueryDto();
      dto.page = -1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints?.isPositive).toBeDefined();
    });

    it('should fail validation with invalid limit (zero)', async () => {
      const dto = new MessagesQueryDto();
      dto.limit = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints?.isPositive).toBeDefined();
    });

    it('should fail validation with invalid limit (negative)', async () => {
      const dto = new MessagesQueryDto();
      dto.limit = -1;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints?.isPositive).toBeDefined();
    });

    it('should fail validation with limit too high', async () => {
      const dto = new MessagesQueryDto();
      dto.limit = 101;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints?.max).toBeDefined();
    });
  });

  describe('properties', () => {
    it('should have optional page property with default value', () => {
      const dto = new MessagesQueryDto();
      expect(dto.page).toBe(1);
    });

    it('should have optional limit property with default value', () => {
      const dto = new MessagesQueryDto();
      expect(dto.limit).toBe(20);
    });

    it('should have optional search property', () => {
      const dto = new MessagesQueryDto();
      expect(dto.search).toBeUndefined();
    });
  });
});
