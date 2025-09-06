import { validate } from 'class-validator';
import { UpdateBucketDto } from './update-bucket.dto';

describe('UpdateBucketDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = new UpdateBucketDto();
      dto.name = 'Updated Bucket';
      dto.description = 'Updated Description';
      dto.icon = 'updated-icon.png';
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with emoji icon', async () => {
      const dto = new UpdateBucketDto();
      dto.icon = '🎯';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with non-HTTP icon', async () => {
      const dto = new UpdateBucketDto();
      dto.icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY2MzQ3Ii8+Cjwvc3ZnPgo=';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with file path icon', async () => {
      const dto = new UpdateBucketDto();
      dto.icon = './assets/icons/custom-icon.png';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty object', async () => {
      const dto = new UpdateBucketDto();

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only name', async () => {
      const dto = new UpdateBucketDto();
      dto.name = 'Updated Bucket';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only description', async () => {
      const dto = new UpdateBucketDto();
      dto.description = 'Updated Description';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only icon', async () => {
      const dto = new UpdateBucketDto();
      dto.icon = 'updated-icon.png';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only color', async () => {
      const dto = new UpdateBucketDto();
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid color format', async () => {
      const dto = new UpdateBucketDto();
      dto.color = 'invalid-color';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('color');
      expect(errors[0].constraints?.matches).toBeDefined();
    });

    it('should pass validation with valid hex color', async () => {
      const dto = new UpdateBucketDto();
      dto.color = '#0a7ea4';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with uppercase hex color', async () => {
      const dto = new UpdateBucketDto();
      dto.color = '#FF5733';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with lowercase hex color', async () => {
      const dto = new UpdateBucketDto();
      dto.color = '#ff5733';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('properties', () => {
    it('should have optional name property', () => {
      const dto = new UpdateBucketDto();
      expect(dto.name).toBeUndefined();
    });

    it('should have optional description property', () => {
      const dto = new UpdateBucketDto();
      expect(dto.description).toBeUndefined();
    });

    it('should have optional icon property', () => {
      const dto = new UpdateBucketDto();
      expect(dto.icon).toBeUndefined();
    });

    it('should have optional color property', () => {
      const dto = new UpdateBucketDto();
      expect(dto.color).toBeUndefined();
    });
  });
});
