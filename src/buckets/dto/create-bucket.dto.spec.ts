import { validate } from 'class-validator';
import { CreateBucketDto } from './create-bucket.dto';

describe('CreateBucketDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.description = 'Test Description';
      dto.icon = 'bucket-icon.png';
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with emoji icon', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.icon = '🚀';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with non-HTTP icon', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.icon =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with file path icon', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.icon = '/path/to/icon.svg';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only required fields', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation without name', async () => {
      const dto = new CreateBucketDto();
      dto.description = 'Test Description';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should fail validation with invalid color format', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.color = 'invalid-color';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('color');
      expect(errors[0].constraints?.matches).toBeDefined();
    });

    it('should pass validation with valid hex color', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.color = '#0a7ea4';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with uppercase hex color', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.color = '#FF5733';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with lowercase hex color', async () => {
      const dto = new CreateBucketDto();
      dto.name = 'Test Bucket';
      dto.color = '#ff5733';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('properties', () => {
    it('should have name property', () => {
      const dto = new CreateBucketDto();
      expect(dto.name).toBeUndefined();
    });

    it('should have optional description property', () => {
      const dto = new CreateBucketDto();
      expect(dto.description).toBeUndefined();
    });

    it('should have optional icon property', () => {
      const dto = new CreateBucketDto();
      expect(dto.icon).toBeUndefined();
    });

    it('should have optional color property', () => {
      const dto = new CreateBucketDto();
      expect(dto.color).toBeUndefined();
    });
  });
});
