/**
 * Common utility functions for modular quiz questions.
 */

export const pruneOptions = (options: any, type: string) => {
  if (type === 'multi_true_false') {
    if (options && typeof options === 'object' && !Array.isArray(options) && Array.isArray(options.statements)) {
      return options.statements;
    }
  }
  let renderedOptions = Array.isArray(options) ? options : [];
  const isChoiceType = type === 'single_choice' || type === 'multiple_choice';
  if (isChoiceType && renderedOptions.length > 4) {
    const hasEmptyExtraOptions = renderedOptions.slice(4).every((opt: any) =>
      !opt.text || opt.text.trim() === '' || opt.text.toLowerCase() === 'none' || opt.text.toLowerCase() === 'nan'
    );
    if (hasEmptyExtraOptions) {
      renderedOptions = renderedOptions.slice(0, 4);
    }
  }
  return renderedOptions;
};
